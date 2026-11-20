import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { configureAuth } from '../src/services/auth.service.js';
import * as redisModule from '../src/lib/redis.js';

const ACCESS_SECRET = 'test-access-secret-must-be-32-chars!!';
const REFRESH_SECRET = 'test-refresh-secret-must-be-32-chars!';

// In-memory Redis mock — simulates hash operations
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

// Mock Redis module
vi.spyOn(redisModule, 'getRedis').mockReturnValue(redisMock as any);

// Configure auth with test secrets
configureAuth({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
  accessExpiresIn: '15m' as const,
  refreshExpiresIn: '7d' as const,
});

// bcryptjs hash of 'correctpassword' with cost 12
// We'll generate it inline for testing
import bcrypt from 'bcryptjs';

const fakeUserId = '507f191e810c19729de860ea';
const fakeTenantId = '507f1f77bcf86cd799439011';

function makeFakeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: fakeUserId,
    tenantId: fakeTenantId,
    email: 'alice@acme.com',
    name: 'Alice Smith',
    role: 'OWNER',
    status: 'ACTIVE',
    passwordHash: bcrypt.hashSync('correctpassword', 4), // cost 4 for speed in tests
    lastLoginAt: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Auth (S1-T03)', () => {
  const app = createApp('silent');

  beforeEach(() => {
    vi.restoreAllMocks();
    // Re-mock getRedis since restoreAllMocks clears it
    vi.spyOn(redisModule, 'getRedis').mockReturnValue(redisMock as any);
    redisStore.clear();
    redisMock.hset.mockClear();
    redisMock.hget.mockClear();
    redisMock.hdel.mockClear();
    redisMock.del.mockClear();
    redisMock.expire.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Login ──

  it('POST /login — rejects invalid payload', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.type).toBe('/errors/validation');
  });

  it('POST /login — rejects wrong email', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@acme.com',
      password: 'whatever',
    });

    expect(res.status).toBe(401);
    expect(res.body.type).toBe('/errors/invalid-credentials');
  });

  it('POST /login — rejects wrong password', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(makeFakeUser() as any);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@acme.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.type).toBe('/errors/invalid-credentials');
  });

  it('POST /login — returns tokens on valid credentials', async () => {
    const fakeUser = makeFakeUser();
    vi.spyOn(User, 'findOne').mockResolvedValue(fakeUser as any);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@acme.com',
      password: 'correctpassword',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe('alice@acme.com');
    expect(res.body.data.user.role).toBe('OWNER');

    // Verify access token is valid JWT
    const decoded = jwt.verify(res.body.data.tokens.accessToken, ACCESS_SECRET) as any;
    expect(decoded.sub).toBe(fakeUserId);
    expect(decoded.tenantId).toBe(fakeTenantId);
    expect(decoded.role).toBe('OWNER');

    // Verify refresh token stored in Redis
    expect(redisMock.hset).toHaveBeenCalled();
  });

  // ── Refresh ──

  it('POST /refresh — rotates tokens', async () => {
    // First login to get tokens
    const fakeUser = makeFakeUser();
    vi.spyOn(User, 'findOne').mockResolvedValue(fakeUser as any);
    vi.spyOn(User, 'findById').mockResolvedValue(fakeUser as any);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@acme.com',
      password: 'correctpassword',
    });

    const oldRefresh = loginRes.body.data.tokens.refreshToken;

    // Refresh
    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: oldRefresh,
    });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    // New tokens should differ from old
    expect(refreshRes.body.data.refreshToken).not.toBe(oldRefresh);
  });

  it('POST /refresh — reuse detection revokes all sessions', async () => {
    const fakeUser = makeFakeUser();
    vi.spyOn(User, 'findOne').mockResolvedValue(fakeUser as any);
    vi.spyOn(User, 'findById').mockResolvedValue(fakeUser as any);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@acme.com',
      password: 'correctpassword',
    });

    const oldRefresh = loginRes.body.data.tokens.refreshToken;

    // First refresh — succeeds
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh });

    // Second use of SAME old token — reuse detected
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.type).toBe('/errors/token-reuse');
    // All sessions revoked
    expect(redisMock.del).toHaveBeenCalledWith(`rt:${fakeUserId}`);
  });

  it('POST /refresh — rejects expired token', async () => {
    // Sign a refresh token that's already expired
    const expiredToken = jwt.sign(
      { sub: fakeUserId, tenantId: fakeTenantId, role: 'OWNER', jti: 'old-jti' },
      REFRESH_SECRET,
      { expiresIn: '0s' },
    );

    // Small delay to ensure expiration
    await new Promise((r) => setTimeout(r, 50));

    const res = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: expiredToken,
    });

    expect(res.status).toBe(401);
    expect(res.body.type).toBe('/errors/invalid-token');
  });

  // ── Logout ──

  it('POST /logout — revokes refresh token and returns 204', async () => {
    const fakeUser = makeFakeUser();
    vi.spyOn(User, 'findOne').mockResolvedValue(fakeUser as any);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@acme.com',
      password: 'correctpassword',
    });

    const refreshToken = loginRes.body.data.tokens.refreshToken;

    const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken });

    expect(logoutRes.status).toBe(204);
    expect(redisMock.hdel).toHaveBeenCalled();
  });

  // ── Auth Middleware ──

  it('requireAuth — rejects request without Authorization header', async () => {
    // We need a protected route to test. Use a simple test setup.
    const { requireAuth } = await import('../src/middleware/auth.middleware.js');
    const express = await import('express');
    const { errorHandler } = await import('@supportpilot/shared-lib');
    const { createLogger } = await import('@supportpilot/shared-lib');

    const testApp = express.default();
    testApp.use(express.default.json());
    testApp.get('/protected', requireAuth, (_req, res) => {
      res.json({ ok: true, user: _req.user });
    });
    testApp.use(errorHandler(createLogger('test', 'silent')));

    const res = await request(testApp).get('/protected');
    expect(res.status).toBe(401);
  });

  it('requireAuth — passes with valid access token', async () => {
    const { requireAuth } = await import('../src/middleware/auth.middleware.js');
    const express = await import('express');
    const { errorHandler, createLogger } = await import('@supportpilot/shared-lib');

    const testApp = express.default();
    testApp.use(express.default.json());
    testApp.get('/protected', requireAuth, (_req, res) => {
      res.json({ ok: true, user: _req.user });
    });
    testApp.use(errorHandler(createLogger('test', 'silent')));

    const token = jwt.sign(
      { sub: fakeUserId, tenantId: fakeTenantId, role: 'OWNER' },
      ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(testApp).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.sub).toBe(fakeUserId);
    expect(res.body.user.tenantId).toBe(fakeTenantId);
  });
});
