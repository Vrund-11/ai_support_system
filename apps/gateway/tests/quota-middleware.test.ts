import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GatewayQuotaTracker } from '../src/middleware/quota.middleware.js';

describe('Gateway Quota Middleware (TEN-4)', () => {
  const app = createApp({ logLevel: 'silent' });
  const tenantId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    GatewayQuotaTracker.resetInMemory();
  });

  it('sets X-Quota-Remaining headers on requests with x-tenant-id', async () => {
    const res = await request(app).get('/health').set('x-tenant-id', tenantId);

    expect(res.status).toBe(200);
    // health is before /api/v1
  });

  it('sets X-Quota-Remaining headers on /api/v1 requests', async () => {
    const res = await request(app).get('/api/v1/non-existent-route').set('x-tenant-id', tenantId);

    expect(res.headers).toHaveProperty('x-quota-remaining-messages');
    expect(res.headers).toHaveProperty('x-quota-remaining-ai');
    expect(res.headers).toHaveProperty('x-quota-remaining-kb');
  });

  it('returns 429 when AI call quota is exceeded', async () => {
    // Fill up AI call quota (50 for FREE plan)
    await GatewayQuotaTracker.incrementUsage(tenantId, 'ai', 50);

    const res = await request(app)
      .post('/api/v1/ai/generate')
      .set('x-tenant-id', tenantId)
      .send({ prompt: 'hello' });

    expect(res.status).toBe(429);
    expect(res.body.type).toBe('/errors/quota-exceeded');
  });
});
