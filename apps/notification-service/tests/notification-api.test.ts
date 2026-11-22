import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createLogger } from '@supportpilot/shared-lib';
import { QueueManager } from '../src/manager';
import { MemoryIdempotencyStore } from '../src/idempotency';
import { createApp } from '../src/app';

describe('Notification Service REST API (NOTIF-5)', () => {
  let app: Express;
  let queueManager: QueueManager;
  const serviceToken = 'test-secret-service-token-12345';
  const logger = createLogger('test-api-logger', 'silent');

  beforeEach(() => {
    const idempotencyStore = new MemoryIdempotencyStore();
    queueManager = new QueueManager({
      idempotencyStore,
      logger,
      inMemory: true, // Hermetic test mode without requiring live external Redis server
    });

    app = createApp({
      queueManager,
      logger,
      serviceToken,
    });
  });

  afterEach(async () => {
    await queueManager.close();
  });

  it('responds with 200 on /health probe without authentication', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rejects unauthenticated requests to protected endpoints with 401', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/enqueue')
      .send({
        queue: 'email',
        data: { tenantId: 'tenant_1', to: 'a@b.com' },
      });

    expect(res.status).toBe(401);
    expect(res.body.title).toBe('Unauthorized');
  });

  it('validates request payload and enqueues job with 202 Accepted', async () => {
    // Missing tenantId
    const badRes = await request(app)
      .post('/api/v1/notifications/enqueue')
      .set('x-service-token', serviceToken)
      .send({
        queue: 'email',
        data: { to: 'missing@tenant.com' },
      });
    expect(badRes.status).toBe(400);

    // Valid job
    const res = await request(app)
      .post('/api/v1/notifications/enqueue')
      .set('x-service-token', serviceToken)
      .send({
        queue: 'email',
        data: {
          tenantId: 'tenant_valid_123',
          to: 'customer@example.com',
          subject: 'Your ticket has been resolved',
          body: 'Ticket #1042 is resolved.',
        },
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.queue).toBe('email');
  });

  it('returns queue metrics across all notification queues', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/metrics')
      .set('x-service-token', serviceToken);

    expect(res.status).toBe(200);
    expect(res.body.metrics).toBeInstanceOf(Array);
    expect(res.body.metrics.length).toBe(6); // email, push, webhook, sla, audit, dlq

    const queueNames = res.body.metrics.map((m: { queue: string }) => m.queue);
    expect(queueNames).toContain('email');
    expect(queueNames).toContain('dlq');
  });

  it('lists and replays dead-letter queue records for a tenant', async () => {
    const tenantId = 'tenant_dlq_api_test';

    // Route a simulated failure to DLQ
    const dlqRecord = await queueManager.routeToDLQ(
      'push',
      {
        id: 'job_push_fail',
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: {
          tenantId,
          userId: 'user_456',
          title: 'New message',
          body: 'Hello',
        },
      },
      new Error('FCM token unregistered'),
    );

    // 1. Fetch DLQ records without tenantId -> 400
    const noTenantRes = await request(app)
      .get('/api/v1/notifications/dlq')
      .set('x-service-token', serviceToken);
    expect(noTenantRes.status).toBe(400);

    // 2. Fetch DLQ records with tenantId -> 200
    const dlqRes = await request(app)
      .get(`/api/v1/notifications/dlq?tenantId=${tenantId}`)
      .set('x-service-token', serviceToken);

    expect(dlqRes.status).toBe(200);
    expect(dlqRes.body.total).toBe(1);
    expect(dlqRes.body.items[0].dlqId).toBe(dlqRecord.dlqId);

    // 3. Replay DLQ record
    const replayRes = await request(app)
      .post(`/api/v1/notifications/dlq/${dlqRecord.dlqId}/replay`)
      .set('x-service-token', serviceToken)
      .send({ tenantId });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.success).toBe(true);
    expect(replayRes.body.newJobId).toBeDefined();

    // 4. Verify DLQ is now empty for this tenant
    const afterReplayRes = await request(app)
      .get(`/api/v1/notifications/dlq?tenantId=${tenantId}`)
      .set('x-service-token', serviceToken);
    expect(afterReplayRes.body.total).toBe(0);
  });
});
