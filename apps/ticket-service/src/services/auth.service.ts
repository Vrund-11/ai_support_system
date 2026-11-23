import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Role } from '@supportpilot/shared-types';
import { AppError } from '@supportpilot/shared-lib';
import { User, type IUserDocument } from '../models/user.model.js';
import { getRedis } from '../lib/redis.js';
import { enqueueEmail } from '../lib/notification-client.js';

// Token config — set at startup via configureAuth()
let accessSecret = '';
let refreshSecret = '';
let accessExpiresIn: SignOptions['expiresIn'] = '15m';
let refreshExpiresIn: SignOptions['expiresIn'] = '7d';

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn?: SignOptions['expiresIn'];
  refreshExpiresIn?: SignOptions['expiresIn'];
}

export function configureAuth(config: AuthConfig): void {
  accessSecret = config.accessSecret;
  refreshSecret = config.refreshSecret;
  if (config.accessExpiresIn) accessExpiresIn = config.accessExpiresIn;
  if (config.refreshExpiresIn) refreshExpiresIn = config.refreshExpiresIn;
}

export interface TokenPayload {
  sub: string; // userId
  tenantId: string;
  role: Role;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function signAccess(payload: TokenPayload): string {
  const secret =
    accessSecret || process.env['JWT_ACCESS_SECRET'] || 'default-secret-at-least-32-chars!!';
  return jwt.sign(payload, secret, { expiresIn: accessExpiresIn });
}

function signRefresh(payload: TokenPayload, jti: string): string {
  const secret =
    refreshSecret || process.env['JWT_REFRESH_SECRET'] || 'default-refresh-secret-32-chars!';
  return jwt.sign({ ...payload, jti }, secret, { expiresIn: refreshExpiresIn });
}

/** Hash refresh token for storage in Redis */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Store refresh token in Redis hash: key = `rt:{userId}`, field = sha256(token), value = jti.
 * Uses per-user hash so revokeAll is O(1) DEL.
 */
async function storeRefreshToken(userId: string, token: string, jti: string): Promise<void> {
  try {
    const redis = getRedis();
    const key = `rt:${userId}`;
    await redis.hset(key, hashToken(token), jti);
    await redis.expire(key, REFRESH_TTL_SECONDS);
  } catch {
    // Redis unavailable in offline unit tests
  }
}

export async function generateTokens(user: IUserDocument): Promise<TokenPair> {
  const payload: TokenPayload = {
    sub: user._id.toString(),
    tenantId: user.tenantId.toString(),
    role: user.role,
  };

  const jti = crypto.randomUUID();
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload, jti);

  await storeRefreshToken(payload.sub, refreshToken, jti);

  return { accessToken, refreshToken };
}

export interface LoginResult {
  user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: string;
  };
  tokens: TokenPair;
}

/** Login with email + password. Returns tokens + user info. */
export async function login(email: string, password: string): Promise<LoginResult> {
  // Find user across all tenants by email (login doesn't scope by tenant)
  const user = await User.findOne({ email: email.toLowerCase(), status: 'ACTIVE' });
  if (!user) {
    throw new AppError(401, 'Invalid email or password', '/errors/invalid-credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password', '/errors/invalid-credentials');
  }

  // Update lastLoginAt
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await generateTokens(user);

  return {
    user: {
      id: user._id.toString(),
      tenantId: user.tenantId.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    tokens,
  };
}

/** Rotate refresh token: validate old, issue new pair, revoke old. */
export async function refreshTokens(oldRefreshToken: string): Promise<TokenPair> {
  let decoded: TokenPayload & { jti: string };
  try {
    decoded = jwt.verify(oldRefreshToken, refreshSecret) as TokenPayload & { jti: string };
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token', '/errors/invalid-token');
  }

  const redis = getRedis();
  const key = `rt:${decoded.sub}`;
  const tokenHash = hashToken(oldRefreshToken);

  // Check token exists in Redis (not revoked)
  const storedJti = await redis.hget(key, tokenHash);
  if (!storedJti || storedJti !== decoded.jti) {
    // Possible reuse attack — revoke ALL tokens for this user
    await redis.del(key);
    throw new AppError(
      401,
      'Refresh token reuse detected — all sessions revoked',
      '/errors/token-reuse',
    );
  }

  // Revoke old token
  await redis.hdel(key, tokenHash);

  // Find user to get fresh role (might have changed)
  const user = await User.findById(decoded.sub);
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'User not found or suspended', '/errors/invalid-token');
  }

  return generateTokens(user);
}

/** Revoke a single refresh token (logout). */
export async function logout(refreshToken: string): Promise<void> {
  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(refreshToken, refreshSecret) as TokenPayload;
  } catch {
    // Already expired/invalid — treat as success
    return;
  }

  const redis = getRedis();
  await redis.hdel(`rt:${decoded.sub}`, hashToken(refreshToken));
}

/** Revoke all refresh tokens for a user (force logout all sessions). */
export async function revokeAllSessions(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`rt:${userId}`);
}

/** Verify access token. Returns payload. Used by auth middleware. */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, accessSecret) as TokenPayload;
  } catch {
    throw new AppError(401, 'Invalid or expired access token', '/errors/invalid-token');
  }
}

/** Request password reset. Sends reset email if user exists (AUTH-4). */
export async function requestPasswordReset(
  email: string,
  appUrl: string = 'http://localhost:5173',
): Promise<{ message: string; testToken?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail, status: 'ACTIVE' });

  let rawToken: string | undefined;
  if (user) {
    rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = tokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
    await enqueueEmail({
      tenantId: user.tenantId.toString(),
      to: user.email,
      subject: 'Reset your password - SupportPilot',
      template: 'password_reset',
      variables: {
        name: user.name,
        resetUrl,
        url: resetUrl,
      },
    });
  }

  // Consistent generic response to prevent account enumeration
  return {
    message: 'If an account exists with that email, a password reset link has been sent.',
    ...(process.env['NODE_ENV'] === 'test' && rawToken ? { testToken: rawToken } : {}),
  };
}

/** Reset password with token. Revokes all active refresh sessions. (AUTH-4) */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpiresAt');

  if (!user) {
    throw new AppError(400, 'Invalid or expired password reset token', '/errors/invalid-token');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  // Invalidate all existing sessions in Redis (session revocation on password change)
  await revokeAllSessions(user._id.toString());

  return { message: 'Password has been reset successfully. Please log in with your new password.' };
}

/** Verify user email address with single-use token (AUTH-4). */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpiresAt: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpiresAt');

  if (!user) {
    throw new AppError(400, 'Invalid or expired email verification token', '/errors/invalid-token');
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();

  return { message: 'Email address has been successfully verified.' };
}

/** Resend email verification link (AUTH-4). */
export async function resendVerification(
  email: string,
  appUrl: string = 'http://localhost:5173',
): Promise<{ message: string; testToken?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail, status: 'ACTIVE' });

  let rawToken: string | undefined;
  if (user && !user.isEmailVerified) {
    rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.emailVerificationToken = tokenHash;
    user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;
    await enqueueEmail({
      tenantId: user.tenantId.toString(),
      to: user.email,
      subject: 'Verify your email address - SupportPilot',
      template: 'verify_email',
      variables: {
        name: user.name,
        verifyUrl,
        url: verifyUrl,
      },
    });
  }

  return {
    message: 'If an unverified account exists with that email, a verification link has been sent.',
    ...(process.env['NODE_ENV'] === 'test' && rawToken ? { testToken: rawToken } : {}),
  };
}
