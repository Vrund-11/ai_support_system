import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { Tenant } from '../src/models/tenant.model.js';
import { User } from '../src/models/user.model.js';
import { Ticket } from '../src/models/ticket.model.js';
import { AuditLogModel } from '../src/models/audit-log.model.js';

const ACCESS_SECRET = 'test-access-secret-must-be-32-chars!!';
const REFRESH_SECRET = 'test-refresh-secret-must-be-32-chars!';
const SUPERADMIN_SECRET = 'superadmin-platform-secret-must-be-32-chars-long!';

configureAuth({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
  accessExpiresIn: '15m' as const,
  refreshExpiresIn: '7d' as const,
});

process.env['JWT_ACCESS_SECRET'] = ACCESS_SECRET;
process.env['SUPERADMIN_EMAIL'] = 'admin@supportpilot.io';
process.env['SUPERADMIN_PASSWORD'] = 'SuperAdminSecret2026!';
process.env['SUPERADMIN_JWT_SECRET'] = SUPERADMIN_SECRET;

const tenantAId = new Types.ObjectId('507f1f77bcf86cd799439011');
const tenantBId = new Types.ObjectId('507f1f77bcf86cd799439022');

function createTenantUserToken(role: 'AGENT' | 'OWNER' = 'AGENT'): string {
  return jwt.sign(
    {
      sub: '507f191e810c19729de860aa',
      email: 'user@acme.com',
      tenantId: tenantAId.toString(),
      role,
    },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

function mockQuery<T>(results: T[]) {
  const p: any = Promise.resolve(results);
  p.sort = () => p;
  p.limit = () => p;
  p.lean = () => Promise.resolve(results);
  p.exec = () => Promise.resolve(results);
  return p;
}

describe('SuperAdmin Platform Portal APIs (superadmin.routes.ts)', () => {
  const app = createApp('silent');
  let tenantsDb: any[] = [];
  let usersDb: any[] = [];
  let auditLogsDb: any[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();

    tenantsDb = [
      {
        _id: tenantAId,
        name: 'Acme Corp',
        slug: 'acme',
        plan: 'PRO',
        status: 'ACTIVE',
        quotas: {
          maxUsers: 30,
          maxTicketsPerMonth: 20000,
          maxAiTokensPerMonth: 10000000,
          vectorLimitGb: 10,
        },
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        save: function () {
          return Promise.resolve(this);
        },
      },
      {
        _id: tenantBId,
        name: 'Globex Inc',
        slug: 'globex',
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        quotas: {
          maxUsers: 100,
          maxTicketsPerMonth: 50000,
          maxAiTokensPerMonth: 50000000,
          vectorLimitGb: 50,
        },
        createdAt: new Date('2026-01-03T00:00:00Z'),
        updatedAt: new Date('2026-01-04T00:00:00Z'),
        save: function () {
          return Promise.resolve(this);
        },
      },
    ];

    usersDb = [
      {
        _id: new Types.ObjectId('507f191e810c19729de860aa'),
        tenantId: tenantAId,
        email: 'admin@acme.com',
        name: 'Acme Admin',
        role: 'OWNER',
        status: 'ACTIVE',
        isEmailVerified: true,
        createdAt: new Date('2026-01-01T01:00:00Z'),
      },
    ];

    auditLogsDb = [
      {
        _id: new Types.ObjectId('507f191e810c19729de860bb'),
        tenantId: tenantAId,
        userEmail: 'admin@supportpilot.io',
        action: 'TENANT_PROVISIONED',
        resource: 'Tenant',
        resourceId: tenantAId.toString(),
        createdAt: new Date('2026-01-01T02:00:00Z'),
      },
    ];

    // Mock Tenant
    vi.spyOn(Tenant, 'find').mockImplementation((filter?: any) => {
      let filtered = [...tenantsDb];
      if (filter?.plan?.$in) {
        filtered = filtered.filter((t) => filter.plan.$in.includes(t.plan));
      }
      return mockQuery(filtered);
    });

    vi.spyOn(Tenant, 'findById').mockImplementation((id: any) => {
      const match = tenantsDb.find((t) => t._id.toString() === id.toString());
      if (!match) return Promise.resolve(null) as any;
      const res: any = Promise.resolve(match);
      res.lean = () => Promise.resolve(match);
      return res;
    });

    vi.spyOn(Tenant, 'findByIdAndUpdate').mockImplementation((id: any, update: any) => {
      const match = tenantsDb.find((t) => t._id.toString() === id.toString());
      if (!match) return Promise.resolve(null) as any;
      if (update.$set) Object.assign(match, update.$set);
      else Object.assign(match, update);
      return Promise.resolve(match) as any;
    });

    vi.spyOn(Tenant, 'countDocuments').mockImplementation((filter?: any) => {
      let filtered = [...tenantsDb];
      if (filter?.status) {
        filtered = filtered.filter((t) => t.status === filter.status);
      }
      if (filter?.plan) {
        filtered = filtered.filter((t) => t.plan === filter.plan);
      }
      return Promise.resolve(filtered.length) as any;
    });

    // Mock User
    vi.spyOn(User, 'find').mockImplementation(() => mockQuery(usersDb));
    vi.spyOn(User, 'findOne').mockImplementation((filter?: any) => {
      const match = usersDb.find((u) => {
        if (filter?.tenantId && !u.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      const p: any = Promise.resolve(match || null);
      p.sort = () => p;
      p.lean = () => Promise.resolve(match || null);
      return p;
    });
    vi.spyOn(User, 'countDocuments').mockImplementation(
      () => Promise.resolve(usersDb.length) as any,
    );

    // Mock Ticket
    vi.spyOn(Ticket, 'countDocuments').mockImplementation(() => Promise.resolve(42) as any);

    // Mock AuditLogModel
    vi.spyOn(AuditLogModel, 'find').mockImplementation(() => mockQuery(auditLogsDb));
    vi.spyOn(AuditLogModel, 'create').mockImplementation((doc: any) => {
      auditLogsDb.push({ ...doc, _id: new Types.ObjectId(), createdAt: new Date() });
      return Promise.resolve(doc) as any;
    });
  });

  describe('Authentication & Access Control', () => {
    it('Login with wrong credentials -> 401', async () => {
      const res = await request(app)
        .post('/api/v1/superadmin/auth/login')
        .send({ email: 'wrong@admin.com', password: 'bad-password' });

      expect(res.status).toBe(401);
      expect(res.body.type).toBe('/errors/unauthorized');
    });

    it('Login with correct env credentials -> 200 + token', async () => {
      const res = await request(app)
        .post('/api/v1/superadmin/auth/login')
        .send({ email: 'admin@supportpilot.io', password: 'SuperAdminSecret2026!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toEqual({
        email: 'admin@supportpilot.io',
        role: 'SUPERADMIN',
      });

      const decoded = jwt.verify(res.body.token, SUPERADMIN_SECRET) as any;
      expect(decoded.role).toBe('SUPERADMIN');
      expect(decoded.sub).toBe('superadmin');
    });

    it('Protected routes without token -> 401', async () => {
      const res = await request(app).get('/api/v1/superadmin/metrics');
      expect(res.status).toBe(401);
    });

    it('Protected routes with regular tenant user token -> 403', async () => {
      const tenantToken = createTenantUserToken('OWNER');
      const res = await request(app)
        .get('/api/v1/superadmin/metrics')
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.type).toBe('/errors/forbidden');
    });
  });

  describe('Protected SuperAdmin Endpoints', () => {
    let superadminToken: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/superadmin/auth/login')
        .send({ email: 'admin@supportpilot.io', password: 'SuperAdminSecret2026!' });
      superadminToken = res.body.token;
    });

    it('GET /api/v1/superadmin/auth/me -> 200', async () => {
      const res = await request(app)
        .get('/api/v1/superadmin/auth/me')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        email: 'admin@supportpilot.io',
        role: 'SUPERADMIN',
      });
    });

    it('GET /api/v1/superadmin/metrics -> 200', async () => {
      const res = await request(app)
        .get('/api/v1/superadmin/metrics')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalTenants).toBe(2);
      expect(res.body.activeTenants).toBe(2);
      expect(res.body.suspendedTenants).toBe(0);
      expect(res.body.totalUsers).toBe(1);
      expect(res.body.totalTickets).toBe(42);
      expect(res.body.mrr).toBe(49 * 1 + 299 * 1); // 1 PRO (49) + 1 ENTERPRISE (299)
      expect(res.body.services).toBeDefined();
      expect(res.body.services.mongodb).toBe('healthy');
      expect(res.body.services.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/v1/superadmin/registrations -> 200', async () => {
      const res = await request(app)
        .get('/api/v1/superadmin/registrations')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.registrations || res.body.data;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        plan: expect.any(String),
        status: expect.any(String),
      });
    });

    it('GET /api/v1/superadmin/subscriptions -> 200', async () => {
      const res = await request(app)
        .get('/api/v1/superadmin/subscriptions')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      const subs = res.body.subscriptions || res.body.data;
      expect(Array.isArray(subs)).toBe(true);
      expect(subs.length).toBe(2);
      expect(subs[0]).toMatchObject({
        tenantId: expect.any(String),
        tenantName: expect.any(String),
        slug: expect.any(String),
        interval: 'month',
        status: 'ACTIVE',
        lastBillingEvent: 'SUBSCRIPTION_CREATED',
      });
      const proSub = subs.find((s: any) => s.plan === 'PRO');
      expect(proSub.amount).toBe(49);
      const entSub = subs.find((s: any) => s.plan === 'ENTERPRISE');
      expect(entSub.amount).toBe(299);
    });

    it('GET /api/v1/superadmin/tenants -> 200', async () => {
      const res = await request(app)
        .get('/api/v1/superadmin/tenants')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      const tenants = res.body.tenants || res.body.data;
      expect(Array.isArray(tenants)).toBe(true);
      expect(tenants.length).toBe(2);
      expect(tenants[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        plan: expect.any(String),
        status: expect.any(String),
        userCount: expect.any(Number),
        ticketCount: expect.any(Number),
        quotas: expect.any(Object),
      });
    });

    it('PATCH /api/v1/superadmin/tenants/:id/status -> 200', async () => {
      const res = await request(app)
        .patch(`/api/v1/superadmin/tenants/${tenantAId.toString()}/status`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUSPENDED');
      expect(tenantsDb[0].status).toBe('SUSPENDED');
    });

    it('PATCH /api/v1/superadmin/tenants/:id/plan -> 200', async () => {
      const res = await request(app)
        .patch(`/api/v1/superadmin/tenants/${tenantAId.toString()}/plan`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ plan: 'ENTERPRISE' });

      expect(res.status).toBe(200);
      expect(res.body.plan).toBe('ENTERPRISE');
      expect(tenantsDb[0].plan).toBe('ENTERPRISE');
    });

    it('PATCH /api/v1/superadmin/tenants/:id/quotas -> 200', async () => {
      const newQuotas = {
        maxUsers: 50,
        maxTicketsPerMonth: 35000,
        maxAiTokensPerMonth: 25000000,
        vectorLimitGb: 20,
      };

      const res = await request(app)
        .patch(`/api/v1/superadmin/tenants/${tenantAId.toString()}/quotas`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send(newQuotas);

      expect(res.status).toBe(200);
      expect(res.body.quotas).toEqual(newQuotas);
      expect(tenantsDb[0].quotas).toEqual(newQuotas);
    });

    it('GET /api/v1/superadmin/audit-logs -> 200', async () => {
      const res = await request(app)
        .get('/api/v1/superadmin/audit-logs')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      const logs = res.body.logs || res.body.data;
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0]).toMatchObject({
        action: expect.any(String),
        resource: expect.any(String),
      });
    });
  });
});
