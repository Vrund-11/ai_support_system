import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../lib/api';

describe('Billing API client (TEN-4, SUB-1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getSubscription returns subscription info or fallback defaults', async () => {
    const sub = await api.billing.getSubscription();
    expect(sub).toBeDefined();
    expect(['FREE', 'PRO']).toContain(sub.plan);
    expect(sub.limits).toHaveProperty('messages');
    expect(sub.limits).toHaveProperty('ai');
    expect(sub.limits).toHaveProperty('kb');
    expect(sub.usage).toHaveProperty('messages');
    expect(sub.usage).toHaveProperty('ai');
    expect(sub.usage).toHaveProperty('kb');
  });

  it('createCheckout returns checkout session payload', async () => {
    const session = await api.billing.createCheckout('PRO');
    expect(session).toBeDefined();
    expect(session.checkoutUrl).toContain('stripe');
    expect(session.sessionId).toBeDefined();
  });

  it('simulateWebhook triggers test payment webhook', async () => {
    const res = await api.billing.simulateWebhook('tenant-test-1', 'PRO');
    expect(res).toBeDefined();
    expect(res.received).toBe(true);
  });

  it('updateTenantPlan updates tenant plan', async () => {
    const res = await api.admin.updateTenantPlan('tenant-test-1', 'PRO');
    expect(res).toBeDefined();
    expect(res.success).toBe(true);
    expect(res.plan).toBe('PRO');
  });
});
