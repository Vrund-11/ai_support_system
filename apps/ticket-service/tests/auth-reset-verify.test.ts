import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { configureAuth } from '../src/services/auth.service.js';
import * as redisModule from '../src/lib/redis.js';
import { getDispatchedEmails, clearDispatchedEmails } from '../src/lib/notification-client.js';

const ACCESS_SECRET = 'test-access-secret-must-be-32-chars!!';
const REFRESH_SECRET = 'test-refresh-secret-must-be-32-chars!';

const redisStore = new Map<string, Map<string, string>>();

const redisMock = {
  hset: vi.fn(async (key: string, field: string, value: string) => {
    if (!redisStore.has(key)) redisStore.set(key, new Map());
    redisStore.get(key)!.set(field, value);
    return 1;
  }),
  hget: vi.fn(async (key: string, field: string) => {
    return redisStore.get(key)?.get(field) ?? null;
  }),
  hdel: vi.fn(async (key: string, field: string) => {
    redisStore.get(key)?.delete(field);
    return 1;
  }),
  del: vi.fn(async (key: string) => {
    redisStore.delete(key);
    return 1;
  }),
  expire: vi.fn(async () => 1),
};

vi.spyOn(redisModule, 'getRedis').mockReturnValue(redisMock as any);

configureAuth({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
  accessExpiresIn: '15m' as const,
  refreshExpiresIn: '7d' as const,
});

const fakeUserId = '507f191e810c19729de860ea';
const fakeTenantId = '507f1f77bcf86cd799439011';

function createMockUser(overrides: Record<string, unknown> = {}) {
  const doc: any = {
    _id: fakeUserId,
    tenantId: fakeTenantId,
    email: 'user@example.com',
    name: 'Test User',
    role: 'AGENT',
    status: 'ACTIVE',
    passwordHash: '$2a$12$e8x5aN8H/W5tPz4C1rF8U.v1i7mK9pY2wL3nQ4rS5tU6vW7xY8z9A',
    isEmailVerified: false,
    save: vi.fn(async function () {
      return this;
    }),
    select: vi.fn(function () {
      return this;
    }),
    ...overrides,
  };
  return doc;
}

describe('Auth Password Reset & Email Verification Flow (AUTH-4, NOTIF-3)', () => {
  const app = createApp('silent');

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(redisModule, 'getRedis').mockReturnValue(redisMock as any);
    clearDispatchedEmails();
    redisStore.clear();
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('generates reset token, saves expiration, and dispatches reset email', async () => {
      const mockUser = createMockUser();
      vi.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('password reset link has been sent');

      expect(mockUser.passwordResetToken).toBeDefined();
      expect(mockUser.passwordResetExpiresAt).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();

      const dispatched = getDispatchedEmails();
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].to).toBe('user@example.com');
      expect(dispatched[0].template).toBe('password_reset');
      expect(dispatched[0].variables?.['resetUrl']).toContain('/reset-password?token=');
    });

    it('returns generic success message when user not found (enumeration defense)', async () => {
      vi.spyOn(User, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('password reset link has been sent');
      expect(getDispatchedEmails().length).toBe(0);
    });

    it('rejects invalid email payload with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('/errors/validation');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('resets password, updates hash, clears token, and revokes Redis sessions', async () => {
      const rawToken = 'plain-secret-reset-token-12345';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockUser = createMockUser({
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 3600000),
      });

      // Chain select for select('+passwordResetToken +passwordResetExpiresAt')
      const queryMock: any = {
        select: vi.fn().mockResolvedValue(mockUser),
      };
      vi.spyOn(User, 'findOne').mockReturnValue(queryMock);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'SuperStrongNewPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Password has been reset successfully');

      // Verify password hash updated
      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpiresAt).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      const match = await bcrypt.compare('SuperStrongNewPassword123!', mockUser.passwordHash);
      expect(match).toBe(true);

      // Verify sessions revoked in Redis
      expect(redisMock.del).toHaveBeenCalledWith(`rt:${fakeUserId}`);
    });

    it('rejects expired or invalid reset token with 400', async () => {
      const queryMock: any = {
        select: vi.fn().mockResolvedValue(null),
      };
      vi.spyOn(User, 'findOne').mockReturnValue(queryMock);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'expired-or-fake-token', newPassword: 'NewPassword123!' });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('/errors/invalid-token');
      expect(res.body.title).toContain('Invalid or expired password reset token');
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('marks user email verified and clears token', async () => {
      const rawToken = 'verify-token-xyz';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockUser = createMockUser({
        isEmailVerified: false,
        emailVerificationToken: tokenHash,
        emailVerificationExpiresAt: new Date(Date.now() + 86400000),
      });

      const queryMock: any = {
        select: vi.fn().mockResolvedValue(mockUser),
      };
      vi.spyOn(User, 'findOne').mockReturnValue(queryMock);

      const res = await request(app).post('/api/v1/auth/verify-email').send({ token: rawToken });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Email address has been successfully verified');
      expect(mockUser.isEmailVerified).toBe(true);
      expect(mockUser.emailVerificationToken).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('rejects invalid or expired verification token with 400', async () => {
      const queryMock: any = {
        select: vi.fn().mockResolvedValue(null),
      };
      vi.spyOn(User, 'findOne').mockReturnValue(queryMock);

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: 'invalid-verify-token' });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('/errors/invalid-token');
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('dispatches verification email with token if user is unverified', async () => {
      const mockUser = createMockUser({ isEmailVerified: false });
      vi.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('verification link has been sent');

      expect(mockUser.emailVerificationToken).toBeDefined();
      expect(mockUser.emailVerificationExpiresAt).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();

      const dispatched = getDispatchedEmails();
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].to).toBe('user@example.com');
      expect(dispatched[0].template).toBe('verify_email');
      expect(dispatched[0].variables?.['verifyUrl']).toContain('/verify-email?token=');
    });
  });
});
