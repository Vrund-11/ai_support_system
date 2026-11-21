import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { Tenant } from '../src/models/tenant.model.js';
import { TenantQuotaTracker, PLAN_QUOTAS } from '../src/middleware/quota.middleware.js';

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
const userId = new Types.ObjectId('507f191e810c19729de860aa');

function createToken(role = 'AGENT', tId = tenantAId): string {
  return jwt.sign(
    {
      sub: userId.toString(),
      email: 'user@example.com',
      tenantId: tId.toString(),
      role,
    },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

describe('Billing Engine & Admin Plan Routes (billing.routes.ts, admin.routes.ts)', () => {
  const app = createApp('silent');
  const agentToken = createToken('AGENT');
  const leadToken = createToken('LEAD');
  const ownerToken = createToken('OWNER');

  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    TenantQuotaTracker.resetInMemory();
    process.env = { ...originalEnv };
    delete process.env['STRIPE_SECRET_KEY'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /api/v1/billing/subscription', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/billing/subscription');
      expect(res.status).toBe(401);
    });

    it('returns default FREE plan, limits, and zero usage for free tenant', async () => {
      vi.spyOn(Tenant, 'findById').mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: tenantAId,
          name: 'Acme Corp',
          plan: 'FREE',
        }),
      } as any);

      const res = await request(app)
        .get('/api/v1/billing/subscription')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.plan).toBe('FREE');
      expect(res.body.limits).toEqual(PLAN_QUOTAS.FREE);
      expect(res.body.usage).toEqual({
        messages: 0,
        ai: 0,
        kb: 0,
      });
      expect(res.body.data.plan).toBe('FREE');
    });

    it('returns PRO plan limits and reflects tracked usage', async () => {
      vi.spyOn(Tenant, 'findById').mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: tenantAId,
          name: 'Acme Corp',
          plan: 'PRO',
        }),
      } as any);

      await TenantQuotaTracker.incrementUsage(tenantAId.toString(), 'messages', 15);
      await TenantQuotaTracker.incrementUsage(tenantAId.toString(), 'ai', 3);
      await TenantQuotaTracker.incrementUsage(tenantAId.toString(), 'kb', 2048);

      const res = await request(app)
        .get('/api/v1/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.plan).toBe('PRO');
      expect(res.body.limits).toEqual(PLAN_QUOTAS.PRO);
      expect(res.body.usage.messages).toBe(15);
      expect(res.body.usage.ai).toBe(3);
      expect(res.body.usage.kb).toBe(2048);
    });
  });

  describe('POST /api/v1/billing/checkout', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/billing/checkout').send({ plan: 'PRO' });
      expect(res.status).toBe(401);
    });

    it('rejects invalid plan with 400', async () => {
      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ plan: 'ENTERPRISE_INVALID' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('Invalid plan');
    });

    it('returns mock checkout session when STRIPE_SECRET_KEY is not set', async () => {
      delete process.env['STRIPE_SECRET_KEY'];

      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ plan: 'PRO' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('simulated');
      expect(res.body.sessionId).toMatch(/^cs_mock_[a-z0-9]+/);
      expect(res.body.checkoutUrl).toBe('http://localhost:3000/settings?session_id=mock');
    });

    it('calls live Stripe API when STRIPE_SECRET_KEY is configured', async () => {
      process.env['STRIPE_SECRET_KEY'] = 'sk_test_1234567890';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'cs_live_real_stripe_session_id',
          url: 'https://checkout.stripe.com/c/pay/cs_live_real_stripe_session_id',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ plan: 'PRO' });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBe('cs_live_real_stripe_session_id');
      expect(res.body.checkoutUrl).toBe(
        'https://checkout.stripe.com/c/pay/cs_live_real_stripe_session_id',
      );
      expect(res.body.status).toBe('open');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/checkout/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_test_1234567890',
          }),
        }),
      );
    });

    it('returns error when Stripe API call fails', async () => {
      process.env['STRIPE_SECRET_KEY'] = 'sk_test_1234567890';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({
          error: { message: 'Card declined or invalid request' },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ plan: 'PRO' });

      expect(res.status).toBe(402);
      expect(res.body.title).toBe('Card declined or invalid request');
    });
  });

  describe('POST /api/v1/billing/webhook', () => {
    it('returns 400 when event type is missing', async () => {
      const res = await request(app).post('/api/v1/billing/webhook').send({});
      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('Missing event type');
    });

    it('returns 400 when checkout.session.completed has no tenantId', async () => {
      const res = await request(app).post('/api/v1/billing/webhook').send({
        event: 'checkout.session.completed',
        data: {},
      });
      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('Missing tenantId');
    });

    it('handles mock payload and upgrades tenant to PRO', async () => {
      const updatedTenant = {
        _id: tenantAId,
        name: 'Acme Corp',
        plan: 'PRO',
      };
      const findByIdAndUpdateSpy = vi
        .spyOn(Tenant, 'findByIdAndUpdate')
        .mockResolvedValue(updatedTenant as any);

      const res = await request(app)
        .post('/api/v1/billing/webhook')
        .send({
          event: 'checkout.session.completed',
          data: {
            tenantId: tenantAId.toString(),
            plan: 'PRO',
            customerId: 'cus_123',
            subscriptionId: 'sub_123',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.plan).toBe('PRO');
      expect(findByIdAndUpdateSpy).toHaveBeenCalledWith(
        tenantAId.toString(),
        expect.objectContaining({
          $set: expect.objectContaining({ plan: 'PRO' }),
        }),
        { new: true },
      );
    });

    it('handles standard Stripe webhook event format', async () => {
      const updatedTenant = {
        _id: tenantBId,
        name: 'Beta LLC',
        plan: 'PRO',
      };
      const findByIdAndUpdateSpy = vi
        .spyOn(Tenant, 'findByIdAndUpdate')
        .mockResolvedValue(updatedTenant as any);

      const res = await request(app)
        .post('/api/v1/billing/webhook')
        .send({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_abc123',
              client_reference_id: tenantBId.toString(),
              metadata: {
                tenantId: tenantBId.toString(),
                plan: 'PRO',
              },
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.tenantId).toBe(tenantBId.toString());
      expect(res.body.plan).toBe('PRO');
      expect(findByIdAndUpdateSpy).toHaveBeenCalled();
    });

    it('returns 404 when tenant is not found in database', async () => {
      vi.spyOn(Tenant, 'findByIdAndUpdate').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/billing/webhook')
        .send({
          event: 'checkout.session.completed',
          data: {
            tenantId: '507f1f77bcf86cd799439999',
            plan: 'PRO',
          },
        });

      expect(res.status).toBe(404);
      expect(res.body.detail).toContain('Tenant not found');
    });

    it('acknowledges other webhook events with 200', async () => {
      const res = await request(app)
        .post('/api/v1/billing/webhook')
        .send({
          event: 'invoice.payment_succeeded',
          data: { id: 'in_123' },
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });

  describe('PATCH /api/v1/admin/tenants/:id/plan (RBAC & Manual Plan Control)', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/tenants/${tenantAId}/plan`)
        .send({ plan: 'PRO' });

      expect(res.status).toBe(401);
    });

    it('returns 403 for AGENT role', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/tenants/${tenantAId}/plan`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ plan: 'PRO' });

      expect(res.status).toBe(403);
    });

    it('returns 403 for LEAD role', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/tenants/${tenantAId}/plan`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ plan: 'PRO' });

      expect(res.status).toBe(403);
    });

    it('rejects invalid plan value with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/tenants/${tenantAId}/plan`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'ULTRA' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toBe('Plan must be FREE or PRO');
    });

    it('allows OWNER to manually upgrade tenant to PRO', async () => {
      vi.spyOn(Tenant, 'findByIdAndUpdate').mockResolvedValue({
        _id: tenantAId,
        name: 'Acme Corp',
        slug: 'acme',
        plan: 'PRO',
      } as any);

      const res = await request(app)
        .patch(`/api/v1/admin/tenants/${tenantAId}/plan`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'PRO' });

      expect(res.status).toBe(200);
      expect(res.body.data.plan).toBe('PRO');
      expect(res.body.data.id).toBe(tenantAId.toString());
    });

    it('allows OWNER to manually downgrade tenant to FREE', async () => {
      vi.spyOn(Tenant, 'findByIdAndUpdate').mockResolvedValue({
        _id: tenantAId,
        name: 'Acme Corp',
        slug: 'acme',
        plan: 'FREE',
      } as any);

      const res = await request(app)
        .patch(`/api/v1/admin/tenants/${tenantAId}/plan`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'FREE' });

      expect(res.status).toBe(200);
      expect(res.body.data.plan).toBe('FREE');
    });

    it('returns 404 if tenant to update does not exist', async () => {
      vi.spyOn(Tenant, 'findByIdAndUpdate').mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/v1/admin/tenants/${tenantAId}/plan`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: 'PRO' });

      expect(res.status).toBe(404);
      expect(res.body.detail).toBe('Tenant not found');
    });
  });
});
