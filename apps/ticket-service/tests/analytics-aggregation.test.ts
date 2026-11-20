import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { Ticket } from '../src/models/ticket.model.js';
import { AnalyticsService } from '../src/services/analytics.service.js';
import { configureAuth } from '../src/services/auth.service.js';
import * as redisModule from '../src/lib/redis.js';

const JWT_SECRET = 'test-access-secret-must-be-32-chars!!';
configureAuth({
  accessSecret: JWT_SECRET,
  refreshSecret: 'test-refresh-secret-must-be-32-chars!',
});

const fakeTenantId = '507f1f77bcf86cd799439011';
const otherTenantId = '507f1f77bcf86cd799439099';
const fakeAgentId = '507f191e810c19729de860ea';

function createToken(role = 'AGENT', tenant = fakeTenantId) {
  return jwt.sign({ sub: fakeAgentId, tenantId: tenant, role }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Analytics Aggregation Pipelines (ANL-1..4: S3-T07)', () => {
  const app = createApp('silent');
  const token = createToken('AGENT');

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(redisModule, 'getRedis').mockReturnValue({} as any);
  });

  describe('AnalyticsService Aggregation Logic & Tenant Isolation', () => {
    it('enforces tenantId in volume aggregation pipeline ($match stage 0)', async () => {
      const tenantOid = new Types.ObjectId(fakeTenantId);
      const service = new AnalyticsService(tenantOid);

      const aggregateSpy = vi.spyOn(Ticket, 'aggregate').mockResolvedValueOnce([
        {
          byCategory: [{ _id: 'billing', count: 10 }],
          byPriority: [{ _id: 'HIGH', count: 5 }],
          byStatus: [{ _id: 'OPEN', count: 8 }],
          timeline: [{ _id: '2026-11-20', created: 4, resolved: 3 }],
          total: [{ count: 10 }],
        },
      ]);

      const res = await service.getVolumeAnalytics(7);
      expect(res.totalTickets).toBe(10);
      expect(res.byCategory[0].category).toBe('billing');

      // Verify tenantId was matched in stage 0
      const pipeline = aggregateSpy.mock.calls[0][0] as any[];
      expect(pipeline[0].$match.tenantId).toEqual(tenantOid);
    });

    it('calculates SLA compliance and p50/p90/p99 percentiles from resolution times (ANL-2)', async () => {
      const tenantOid = new Types.ObjectId(fakeTenantId);
      const service = new AnalyticsService(tenantOid);

      vi.spyOn(Ticket, 'aggregate').mockResolvedValueOnce([
        { breached: false, firstResponseMin: 10, resolutionMin: 30 },
        { breached: false, firstResponseMin: 15, resolutionMin: 45 },
        { breached: false, firstResponseMin: 20, resolutionMin: 60 },
        { breached: true, firstResponseMin: 35, resolutionMin: 120 },
      ]);

      const res = await service.getSlaAnalytics(30);
      expect(res.totalEvaluated).toBe(4);
      expect(res.breachedCount).toBe(1);
      expect(res.complianceRate).toBe(0.75); // 3 of 4 compliant
      expect(res.firstResponseTimeMin.p50).toBe(15);
      expect(res.resolutionTimeMin.p50).toBe(45);
      expect(res.resolutionTimeMin.p99).toBe(120);
    });

    it('aggregates agent performance with resolution counts and compliance (ANL-3)', async () => {
      const tenantOid = new Types.ObjectId(fakeTenantId);
      const service = new AnalyticsService(tenantOid);

      vi.spyOn(Ticket, 'aggregate').mockResolvedValueOnce([
        {
          _id: new Types.ObjectId(fakeAgentId),
          assignedCount: 15,
          resolvedCount: 14,
          breachedCount: 1,
          resolutionTimes: [30, 40, 50],
          user: { name: 'Sarah Connor', email: 'sarah@example.com' },
        },
      ]);

      const res = await service.getAgentPerformance(30);
      expect(res.agents.length).toBe(1);
      expect(res.agents[0].name).toBe('Sarah Connor');
      expect(res.agents[0].assignedCount).toBe(15);
      expect(res.agents[0].resolvedCount).toBe(14);
      expect(res.agents[0].avgResolutionTimeMin).toBe(40);
      expect(res.agents[0].slaComplianceRate).toBe(0.93);
    });
  });

  describe('REST Endpoints (/api/v1/analytics)', () => {
    it('GET /api/v1/analytics/overview returns KPI summary', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview?rangeDays=7')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.open).toBeDefined();
      expect(res.body.data.slaCompliance).toBeDefined();
      expect(res.body.data.deflectionRate).toBeDefined();
    });

    it('GET /api/v1/analytics/volume returns rollups (ANL-1)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/volume?rangeDays=7')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rangeDays).toBe(7);
      expect(Array.isArray(res.body.data.byCategory)).toBe(true);
      expect(Array.isArray(res.body.data.byPriority)).toBe(true);
      expect(Array.isArray(res.body.data.timeline)).toBe(true);
    });

    it('GET /api/v1/analytics/sla returns SLA percentiles (ANL-2)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/sla?rangeDays=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.complianceRate).toBeDefined();
      expect(res.body.data.firstResponseTimeMin.p50).toBeDefined();
      expect(res.body.data.resolutionTimeMin.p50).toBeDefined();
    });

    it('GET /api/v1/analytics/agents returns agent leaderboard (ANL-3)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/agents?rangeDays=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.agents)).toBe(true);
    });

    it('GET /api/v1/analytics/deflection returns AI self-service deflection (ANL-4)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/deflection?rangeDays=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deflectionRate).toBeDefined();
      expect(res.body.data.botResolvedCount).toBeDefined();
    });

    it('forbids unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/analytics/overview');
      expect(res.status).toBe(401);
    });
  });
});
