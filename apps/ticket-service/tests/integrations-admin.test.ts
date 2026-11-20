import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { ApiKeyModel } from '../src/models/api-key.model.js';
import { WebhookSubscriptionModel } from '../src/models/webhook.model.js';
import { AuditLogModel } from '../src/models/audit-log.model.js';
import { FeatureFlagModel } from '../src/models/feature-flag.model.js';
import { Tenant } from '../src/models/tenant.model.js';
import { User } from '../src/models/user.model.js';
import { Ticket } from '../src/models/ticket.model.js';

const ACCESS_SECRET = 'test-access-secret-must-be-32-chars!!';
const REFRESH_SECRET = 'test-refresh-secret-must-be-32-chars!';

configureAuth({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
  accessExpiresIn: '15m' as const,
  refreshExpiresIn: '7d' as const,
});

const tenantAId = new Types.ObjectId('507f1f77bcf86cd799439011');
const tenantBId = new Types.ObjectId('507f1f77bcf86cd799439022');

function createToken(tenantId: Types.ObjectId, role: 'AGENT' | 'LEAD' | 'OWNER'): string {
  return jwt.sign(
    {
      sub: '507f191e810c19729de860aa',
      email: 'admin@acme.com',
      tenantId: tenantId.toString(),
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
  p.exec = () => Promise.resolve(results);
  return p;
}

describe('Integrations & Admin REST APIs (INT-1, INT-2, ADM-1, ADM-2, ADM-3)', () => {
  const app = createApp('silent');
  const ownerTokenA = createToken(tenantAId, 'OWNER');
  const leadTokenA = createToken(tenantAId, 'LEAD');
  const agentTokenA = createToken(tenantAId, 'AGENT');

  let apiKeysDb: any[] = [];
  let webhooksDb: any[] = [];
  let auditLogsDb: any[] = [];
  let featureFlagsDb: any[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    apiKeysDb = [];
    webhooksDb = [];
    auditLogsDb = [];
    featureFlagsDb = [];

    // ApiKey mock
    vi.spyOn(ApiKeyModel.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      this.createdAt = new Date();
      apiKeysDb.push(this);
      return Promise.resolve(this);
    });
    vi.spyOn(ApiKeyModel, 'find').mockImplementation((filter: any) => {
      const results = apiKeysDb.filter((k) => {
        if (filter?.tenantId && !k.tenantId.equals(filter.tenantId)) return false;
        if (filter?.revokedAt && filter.revokedAt.$exists === false && k.revokedAt) return false;
        return true;
      });
      return mockQuery(results);
    });
    vi.spyOn(ApiKeyModel, 'findOne').mockImplementation((filter: any) => {
      const match = apiKeysDb.find((k) => {
        if (filter?._id && !k._id.equals(filter._id)) return false;
        if (filter?.tenantId && !k.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      return Promise.resolve(match || null) as any;
    });
    vi.spyOn(ApiKeyModel, 'findOneAndUpdate').mockImplementation((filter: any, update: any) => {
      const match = apiKeysDb.find((k) => {
        if (filter?._id && !k._id.equals(filter._id)) return false;
        if (filter?.tenantId && !k.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      if (match) {
        if (update.$set) Object.assign(match, update.$set);
        else Object.assign(match, update);
      }
      return Promise.resolve(match || null) as any;
    });

    // Webhook mock
    vi.spyOn(WebhookSubscriptionModel.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      this.createdAt = new Date();
      webhooksDb.push(this);
      return Promise.resolve(this);
    });
    vi.spyOn(WebhookSubscriptionModel, 'find').mockImplementation((filter: any) => {
      const results = webhooksDb.filter((w) => {
        if (filter?.tenantId && !w.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      return mockQuery(results);
    });
    vi.spyOn(WebhookSubscriptionModel, 'findOne').mockImplementation((filter: any) => {
      const match = webhooksDb.find((w) => {
        if (filter?._id && !w._id.equals(filter._id)) return false;
        if (filter?.tenantId && !w.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      return Promise.resolve(match || null) as any;
    });
    vi.spyOn(WebhookSubscriptionModel, 'deleteOne').mockImplementation((filter: any) => {
      const idx = webhooksDb.findIndex((w) => {
        if (filter?._id && !w._id.equals(filter._id)) return false;
        if (filter?.tenantId && !w.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      if (idx !== -1) {
        webhooksDb.splice(idx, 1);
        return Promise.resolve({ deletedCount: 1 }) as any;
      }
      return Promise.resolve({ deletedCount: 0 }) as any;
    });

    // AuditLog mock
    vi.spyOn(AuditLogModel.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      this.createdAt = new Date();
      auditLogsDb.push(this);
      return Promise.resolve(this);
    });
    vi.spyOn(AuditLogModel, 'find').mockImplementation((filter: any) => {
      const results = auditLogsDb.filter((a) => {
        if (filter?.tenantId && !a.tenantId.equals(filter.tenantId)) return false;
        if (filter?.action && a.action !== filter.action) return false;
        return true;
      });
      return mockQuery(results);
    });

    // FeatureFlag mock
    vi.spyOn(FeatureFlagModel.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      this.createdAt = new Date();
      this.updatedAt = new Date();
      featureFlagsDb.push(this);
      return Promise.resolve(this);
    });
    vi.spyOn(FeatureFlagModel, 'find').mockImplementation((filter: any) => {
      const results = featureFlagsDb.filter((f) => {
        if (filter?.tenantId && !f.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      return mockQuery(results);
    });
    vi.spyOn(FeatureFlagModel, 'findOne').mockImplementation((filter: any) => {
      const match = featureFlagsDb.find((f) => {
        if (filter?.tenantId && !f.tenantId.equals(filter.tenantId)) return false;
        if (filter?.key && f.key !== filter.key) return false;
        return true;
      });
      return Promise.resolve(match || null) as any;
    });
    vi.spyOn(FeatureFlagModel, 'findOneAndUpdate').mockImplementation(
      (filter: any, update: any) => {
        const match = featureFlagsDb.find((f) => {
          if (filter?.tenantId && !f.tenantId.equals(filter.tenantId)) return false;
          if (filter?.key && f.key !== filter.key) return false;
          return true;
        });
        if (match) {
          if (update.$set) Object.assign(match, update.$set);
          else Object.assign(match, update);
        }
        return Promise.resolve(match || null) as any;
      },
    );
  });

  // ── INT-1: API Keys ──
  it('should create API key, hash secret, return rawKey once, and log audit event', async () => {
    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        name: 'Zapier Production',
        scopes: ['tickets:read', 'tickets:write'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Zapier Production');
    expect(res.body.data.rawKey).toMatch(/^sp_live_[a-f0-9]{40}$/);
    expect(res.body.data.prefix).toBe(res.body.data.rawKey.substring(0, 15) + '...');
    expect(apiKeysDb.length).toBe(1);
    expect(apiKeysDb[0].keyHash).toBeDefined();
    expect(apiKeysDb[0].keyHash).not.toBe(res.body.data.rawKey);

    // Verify audit log
    expect(auditLogsDb.length).toBe(1);
    expect(auditLogsDb[0].action).toBe('API_KEY_CREATED');
  });

  it('should list active API keys masking raw secrets and revoke key', async () => {
    // Create key
    const createRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ name: 'CI Deployment' });

    const keyId = createRes.body.data.id;

    // List keys
    const listRes = await request(app)
      .get('/api/v1/api-keys')
      .set('Authorization', `Bearer ${leadTokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].rawKey).toBeUndefined();
    expect(listRes.body.data[0].prefix).toBeDefined();

    // Revoke key
    const revokeRes = await request(app)
      .delete(`/api/v1/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(revokeRes.status).toBe(204);
    expect(apiKeysDb[0].revokedAt).toBeDefined();

    // Verify audit log
    const revokeAudit = auditLogsDb.find((a) => a.action === 'API_KEY_REVOKED');
    expect(revokeAudit).toBeDefined();
  });

  // ── INT-2: Webhooks ──
  it('should create webhook subscription, test HMAC-SHA256 signature ping, and delete webhook', async () => {
    // Create webhook
    const createRes = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({
        url: 'https://api.external.com/webhooks/supportpilot',
        events: ['ticket.created', 'ticket.updated'],
        description: 'Sync tickets to external CRM',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.url).toBe('https://api.external.com/webhooks/supportpilot');
    expect(createRes.body.data.secret).toMatch(/^whsec_[a-f0-9]{32}$/);
    const webhookId = createRes.body.data.id;

    // Test ping with HMAC signature
    const pingRes = await request(app)
      .post(`/api/v1/webhooks/${webhookId}/test`)
      .set('Authorization', `Bearer ${leadTokenA}`);

    expect(pingRes.status).toBe(200);
    expect(pingRes.body.data.delivered).toBe(true);
    expect(pingRes.body.data.signature).toMatch(/^sha256=[a-f0-9]{64}$/);

    // Delete webhook
    const delRes = await request(app)
      .delete(`/api/v1/webhooks/${webhookId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(delRes.status).toBe(204);
  });

  // ── ADM-2: Audit Logs ──
  it('should list audit events with pagination and filters', async () => {
    await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ name: 'Key 1' });

    const auditRes = await request(app)
      .get('/api/v1/audit-logs?limit=10')
      .set('Authorization', `Bearer ${leadTokenA}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(auditRes.body.data[0].action).toBe('API_KEY_CREATED');
  });

  // ── ADM-3: Feature Flags ──
  it('should list tenant feature flags and toggle state', async () => {
    // List flags (auto-initializes defaults)
    const listRes = await request(app)
      .get('/api/v1/feature-flags')
      .set('Authorization', `Bearer ${agentTokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(5);

    // Toggle flag
    const toggleRes = await request(app)
      .patch('/api/v1/feature-flags/auto_assignment')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ enabled: true });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.key).toBe('auto_assignment');
    expect(toggleRes.body.data.enabled).toBe(true);

    // Verify audit log for feature flag
    const flagAudit = auditLogsDb.find((a) => a.action === 'FEATURE_FLAG_UPDATED');
    expect(flagAudit).toBeDefined();
  });

  // ── ADM-1: Platform Admin Console ──
  it('should return platform health and tenant list for owner', async () => {
    vi.spyOn(Tenant, 'find').mockReturnValue({
      lean: () =>
        Promise.resolve([
          { _id: tenantAId, name: 'Acme Corp', slug: 'acme-corp', createdAt: new Date() },
          { _id: tenantBId, name: 'Globex Inc', slug: 'globex', createdAt: new Date() },
        ]),
    } as any);
    vi.spyOn(User, 'countDocuments').mockResolvedValue(5 as never);
    vi.spyOn(Ticket, 'countDocuments').mockResolvedValue(42 as never);

    const tenantsRes = await request(app)
      .get('/api/v1/admin/tenants')
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(tenantsRes.status).toBe(200);
    expect(tenantsRes.body.data.length).toBe(2);
    expect(tenantsRes.body.data[0].userCount).toBe(5);
    expect(tenantsRes.body.data[0].ticketCount).toBe(42);

    const healthRes = await request(app)
      .get('/api/v1/admin/health')
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(healthRes.status).toBe(200);
    expect(healthRes.body.data.status).toBe('operational');
  });

  // ── RBAC / Cross-Tenant Rejection ──
  it('should reject agent role from creating API keys and webhooks (RBAC)', async () => {
    const keyRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${agentTokenA}`)
      .send({ name: 'Unauthorized Key' });

    expect(keyRes.status).toBe(403);

    const whRes = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${agentTokenA}`)
      .send({ url: 'https://example.com' });

    expect(whRes.status).toBe(403);
  });
});
