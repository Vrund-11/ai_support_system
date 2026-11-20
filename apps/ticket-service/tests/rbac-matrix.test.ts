import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@supportpilot/shared-types';
import { errorHandler, createLogger } from '@supportpilot/shared-lib';
import { requireAuth } from '../src/middleware/auth.middleware.js';
import { requireRoles, requireMinRole } from '../src/middleware/rbac.middleware.js';
import { configureAuth } from '../src/services/auth.service.js';

const ACCESS_SECRET = 'test-access-secret-must-be-32-chars!!';
const REFRESH_SECRET = 'test-refresh-secret-must-be-32-chars!';

configureAuth({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
  accessExpiresIn: '15m' as const,
  refreshExpiresIn: '7d' as const,
});

function createToken(role: Role): string {
  return jwt.sign(
    { sub: '507f191e810c19729de860ea', tenantId: '507f1f77bcf86cd799439011', role },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

function buildTestApp(): Express {
  const app: Express = express();
  app.use(express.json());

  // Public route
  app.get('/api/v1/public', (_req, res) => {
    res.json({ message: 'public' });
  });

  // AGENT+ route (tickets)
  app.get('/api/v1/tickets', requireAuth, requireMinRole('AGENT'), (_req, res) => {
    res.json({ message: 'tickets list' });
  });

  // LEAD+ route (analytics)
  app.get('/api/v1/analytics', requireAuth, requireMinRole('LEAD'), (_req, res) => {
    res.json({ message: 'analytics overview' });
  });

  // OWNER or LEAD route (KB uploads)
  app.post('/api/v1/kb/uploads', requireAuth, requireRoles('OWNER', 'LEAD'), (_req, res) => {
    res.json({ message: 'kb uploads presigned' });
  });

  // OWNER only route (settings)
  app.put('/api/v1/settings', requireAuth, requireRoles('OWNER'), (_req, res) => {
    res.json({ message: 'settings updated' });
  });

  // Deny-by-default route: empty roles list
  app.get('/api/v1/locked', requireAuth, requireRoles(), (_req, res) => {
    res.json({ message: 'never reached' });
  });

  app.use(errorHandler(createLogger('rbac-test', 'silent')));
  return app;
}

describe('T-AUTH-03: RBAC Matrix Tests (AUTH-3)', () => {
  const app = buildTestApp();

  const allRoles: Role[] = ['PLATFORM_ADMIN', 'OWNER', 'LEAD', 'AGENT', 'VIEWER'];

  describe('Public Route: GET /api/v1/public', () => {
    it('allows unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/public');
      expect(res.status).toBe(200);
    });

    it.each(allRoles)('allows authenticated user with role %s', async (role) => {
      const token = createToken(role);
      const res = await request(app).get('/api/v1/public').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('AGENT+ Route: GET /api/v1/tickets (requireMinRole("AGENT"))', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/tickets');
      expect(res.status).toBe(401);
      expect(res.body.type).toBe('/errors/unauthorized');
    });

    const expectedMatrix: [Role, number][] = [
      ['PLATFORM_ADMIN', 200],
      ['OWNER', 200],
      ['LEAD', 200],
      ['AGENT', 200],
      ['VIEWER', 403],
    ];

    it.each(expectedMatrix)('role %s returns %i', async (role, expectedStatus) => {
      const token = createToken(role);
      const res = await request(app).get('/api/v1/tickets').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(res.body.type).toBe('/errors/forbidden');
      }
    });
  });

  describe('LEAD+ Route: GET /api/v1/analytics (requireMinRole("LEAD"))', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/analytics');
      expect(res.status).toBe(401);
    });

    const expectedMatrix: [Role, number][] = [
      ['PLATFORM_ADMIN', 200],
      ['OWNER', 200],
      ['LEAD', 200],
      ['AGENT', 403],
      ['VIEWER', 403],
    ];

    it.each(expectedMatrix)('role %s returns %i', async (role, expectedStatus) => {
      const token = createToken(role);
      const res = await request(app)
        .get('/api/v1/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(res.body.type).toBe('/errors/forbidden');
      }
    });
  });

  describe('OWNER/LEAD Route: POST /api/v1/kb/uploads (requireRoles("OWNER", "LEAD"))', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).post('/api/v1/kb/uploads');
      expect(res.status).toBe(401);
    });

    const expectedMatrix: [Role, number][] = [
      ['PLATFORM_ADMIN', 200],
      ['OWNER', 200],
      ['LEAD', 200],
      ['AGENT', 403],
      ['VIEWER', 403],
    ];

    it.each(expectedMatrix)('role %s returns %i', async (role, expectedStatus) => {
      const token = createToken(role);
      const res = await request(app)
        .post('/api/v1/kb/uploads')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(res.body.type).toBe('/errors/forbidden');
      }
    });
  });

  describe('OWNER Only Route: PUT /api/v1/settings (requireRoles("OWNER"))', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).put('/api/v1/settings');
      expect(res.status).toBe(401);
    });

    const expectedMatrix: [Role, number][] = [
      ['PLATFORM_ADMIN', 200],
      ['OWNER', 200],
      ['LEAD', 403],
      ['AGENT', 403],
      ['VIEWER', 403],
    ];

    it.each(expectedMatrix)('role %s returns %i', async (role, expectedStatus) => {
      const token = createToken(role);
      const res = await request(app)
        .put('/api/v1/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(res.body.type).toBe('/errors/forbidden');
      }
    });
  });

  describe('Deny-By-Default: GET /api/v1/locked (requireRoles())', () => {
    it.each(allRoles)('rejects role %s with 403 when no roles permitted', async (role) => {
      const token = createToken(role);
      const res = await request(app).get('/api/v1/locked').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.type).toBe('/errors/forbidden');
    });
  });
});
