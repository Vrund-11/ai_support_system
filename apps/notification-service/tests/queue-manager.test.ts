import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLogger } from '@supportpilot/shared-lib';
import { QueueManager } from '../src/manager';
import { MemoryIdempotencyStore } from '../src/idempotency';
import { DEFAULT_QUEUE_OPTIONS } from '../src/queues';
import type { EmailJobPayload, WebhookJobPayload } from '../src/types';

describe('QueueManager & BullMQ Configuration (NOTIF-5)', () => {
  let queueManager: QueueManager;
  let idempotencyStore: MemoryIdempotencyStore;
  const logger = createLogger('test-logger', 'silent');

  beforeEach(() => {
    idempotencyStore = new MemoryIdempotencyStore();
    queueManager = new QueueManager({
      idempotencyStore,
      logger,
      inMemory: true, // Hermetic test mode without requiring live external Redis server
    });
  });

  afterEach(async () => {
    await queueManager.close();
  });

  it('configures exponential backoff and retry limits for notification queues per NOTIF-5', () => {
    expect(DEFAULT_QUEUE_OPTIONS.email.attempts).toBe(3);
    expect(DEFAULT_QUEUE_OPTIONS.email.backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });

    expect(DEFAULT_QUEUE_OPTIONS.push.attempts).toBe(3);
    expect(DEFAULT_QUEUE_OPTIONS.push.backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });

    expect(DEFAULT_QUEUE_OPTIONS.webhook.attempts).toBe(5);
    expect(DEFAULT_QUEUE_OPTIONS.webhook.backoff).toEqual({
      type: 'exponential',
      delay: 2000,
    });

    expect(DEFAULT_QUEUE_OPTIONS.sla.attempts).toBe(3);
    expect(DEFAULT_QUEUE_OPTIONS.audit.attempts).toBe(3);
    expect(DEFAULT_QUEUE_OPTIONS.dlq.attempts).toBe(1);
  });

  it('enforces idempotency: duplicate job keys are acquired once and subsequent attempts rejected', async () => {
    const key = 'email:test-duplicate-101';

    const firstAcquire = await idempotencyStore.acquire(key, 3600);
    expect(firstAcquire).toBe(true);

    const secondAcquire = await idempotencyStore.acquire(key, 3600);
    expect(secondAcquire).toBe(false);

    expect(await idempotencyStore.isProcessed(key)).toBe(true);

    await idempotencyStore.release(key);
    expect(await idempotencyStore.isProcessed(key)).toBe(false);
  });

  it('consumer skips processing when duplicate job arrives with same idempotency key', async () => {
    const dispatchers = queueManager.getDispatchers();
    const mockEmailJob = {
      id: 'job_email_unique_1',
      data: {
        tenantId: 'tenant_test',
        idempotencyKey: 'idemp_order_123',
        to: 'user@example.com',
        subject: 'Receipt',
        body: 'Your receipt details',
      },
    };

    // First run -> executes successfully
    const firstResult = await dispatchers.processEmail(mockEmailJob as never);
    expect(firstResult.success).toBe(true);
    expect(firstResult.skipped).toBeUndefined();

    // Second run with same idempotencyKey -> skipped
    const secondResult = await dispatchers.processEmail(mockEmailJob as never);
    expect(secondResult.success).toBe(true);
    expect(secondResult.skipped).toBe(true);
    expect(secondResult.reason).toContain('Duplicate');
  });

  it('routes failed jobs to DLQ with full metadata when retry attempts are exhausted', async () => {
    const tenantId = 'tenant_dlq_corp';
    const failedJob = {
      id: 'job_failed_999',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: {
        tenantId,
        to: 'user@example.com',
        subject: 'Failed invite',
        body: 'Welcome',
      } as EmailJobPayload,
    };

    const dlqRecord = await queueManager.routeToDLQ(
      'email',
      failedJob,
      new Error('SMTP connection timed out'),
    );

    expect(dlqRecord.dlqId).toBeDefined();
    expect(dlqRecord.originalQueue).toBe('email');
    expect(dlqRecord.originalJobId).toBe('job_failed_999');
    expect(dlqRecord.tenantId).toBe(tenantId);
    expect(dlqRecord.failedReason).toBe('SMTP connection timed out');
    expect(dlqRecord.attemptsMade).toBe(3);

    // Verify DLQ retrieval for tenant
    const records = queueManager.getDLQRecords(tenantId);
    expect(records.length).toBe(1);
    expect(records[0].dlqId).toBe(dlqRecord.dlqId);
  });

  it('enforces strict cross-tenant isolation on DLQ records (TEN-1)', async () => {
    const tenantA = 'tenant_alpha';
    const tenantB = 'tenant_beta';

    await queueManager.routeToDLQ(
      'webhook',
      {
        id: 'job_webhook_1',
        attemptsMade: 5,
        opts: { attempts: 5 },
        data: {
          tenantId: tenantA,
          url: 'https://alpha.example.com/webhook',
        } as WebhookJobPayload,
      },
      new Error('500 Internal Server Error'),
    );

    // Tenant A sees their record
    const tenantARecords = queueManager.getDLQRecords(tenantA);
    expect(tenantARecords.length).toBe(1);

    // Tenant B sees nothing
    const tenantBRecords = queueManager.getDLQRecords(tenantB);
    expect(tenantBRecords.length).toBe(0);

    // Tenant B cannot fetch Tenant A's DLQ record by ID
    const crossTenantFetch = queueManager.getDLQRecordById(tenantARecords[0].dlqId, tenantB);
    expect(crossTenantFetch).toBeNull();
  });

  it('allows replaying a DLQ record back into its source queue and cleans up DLQ entry', async () => {
    const tenantId = 'tenant_replay_test';
    const dlqRecord = await queueManager.routeToDLQ(
      'email',
      {
        id: 'job_to_replay_1',
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: {
          tenantId,
          to: 'customer@test.com',
          subject: 'Order confirmation',
          body: 'Thanks for your order',
        } as EmailJobPayload,
      },
      new Error('Temporary network partition'),
    );

    // Tenant B replay attempt fails
    await expect(queueManager.replayDLQRecord(dlqRecord.dlqId, 'tenant_other')).rejects.toThrow(
      /unauthorized/i,
    );

    // Tenant owner replays successfully
    const replayResult = await queueManager.replayDLQRecord(dlqRecord.dlqId, tenantId);
    expect(replayResult.success).toBe(true);
    expect(replayResult.newJobId).toBeDefined();

    // DLQ entry is deleted after replay
    const remaining = queueManager.getDLQRecords(tenantId);
    expect(remaining.length).toBe(0);
  });
});
