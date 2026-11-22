import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Job } from 'bullmq';
import { NotificationDispatchers } from '../src/workers.js';
import { MemoryIdempotencyStore } from '../src/idempotency.js';
import { createLogger } from '@supportpilot/shared-lib';
import type { WebhookJobPayload } from '../src/types.js';
import * as queuePackage from '@supportpilot/queue';
import { createHmac } from 'node:crypto';

describe('Notification Service Webhook Worker (Feature 45)', () => {
  let idempotencyStore: MemoryIdempotencyStore;
  const logger = createLogger('test-webhook-worker');
  const originalEnv = process.env;

  beforeEach(() => {
    idempotencyStore = new MemoryIdempotencyStore();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('SQS Transport (WEBHOOK_TRANSPORT=sqs)', () => {
    it('publishes formatted message to SQS and returns success payload', async () => {
      process.env['WEBHOOK_TRANSPORT'] = 'sqs';
      process.env['SQS_WEBHOOK_QUEUE_URL'] = 'http://localhost:4566/000000000000/test-webhooks';

      const publishSpy = vi.spyOn(queuePackage, 'publishToSQS').mockResolvedValue('msg-sqs-999');

      const dispatchers = new NotificationDispatchers(idempotencyStore, logger);
      const mockJob = {
        id: 'job-101',
        attemptsMade: 0,
        data: {
          tenantId: 'tenant-omega',
          webhookId: 'whk-55',
          idempotencyKey: 'idemp-hook-001',
          url: 'https://subscriber.example.com/events',
          event: 'ticket.created',
          payload: { ticketId: 'tkt-123', subject: 'Login issue' },
          secret: 'whsec_custom_secret_key_12345',
        } as WebhookJobPayload,
      } as unknown as Job<WebhookJobPayload>;

      const result = await dispatchers.processWebhook(mockJob);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        transport: 'sqs',
        messageId: 'msg-sqs-999',
        deliveryId: 'idemp-hook-001',
        event: 'ticket.created',
        tenantId: 'tenant-omega',
      });

      expect(publishSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy).toHaveBeenCalledWith('http://localhost:4566/000000000000/test-webhooks', {
        deliveryId: 'idemp-hook-001',
        tenantId: 'tenant-omega',
        url: 'https://subscriber.example.com/events',
        event: 'ticket.created',
        payload: { ticketId: 'tkt-123', subject: 'Login issue' },
        attempt: 1,
      });
    });

    it('propagates error when SQS publish fails so BullMQ can retry', async () => {
      process.env['WEBHOOK_TRANSPORT'] = 'sqs';
      vi.spyOn(queuePackage, 'publishToSQS').mockRejectedValue(new Error('SQS Connection refused'));

      const dispatchers = new NotificationDispatchers(idempotencyStore, logger);
      const mockJob = {
        id: 'job-102',
        attemptsMade: 1,
        data: {
          tenantId: 'tenant-omega',
          webhookId: 'whk-56',
          url: 'https://subscriber.example.com/events',
          event: 'ticket.resolved',
          payload: { ticketId: 'tkt-123' },
          secret: 'whsec_custom',
        } as WebhookJobPayload,
      } as unknown as Job<WebhookJobPayload>;

      await expect(dispatchers.processWebhook(mockJob)).rejects.toThrow('SQS Connection refused');
    });

    it('releases idempotency key on SQS publish failure so subsequent retry attempt succeeds', async () => {
      process.env['WEBHOOK_TRANSPORT'] = 'sqs';
      process.env['SQS_WEBHOOK_QUEUE_URL'] = 'http://localhost:4566/000000000000/test-webhooks';

      const publishSpy = vi
        .spyOn(queuePackage, 'publishToSQS')
        .mockRejectedValueOnce(new Error('SQS Temporary Network Glitch'))
        .mockResolvedValueOnce('msg-sqs-retry-success');

      const dispatchers = new NotificationDispatchers(idempotencyStore, logger);
      const mockJobAttempt1 = {
        id: 'job-sqs-retry-1',
        attemptsMade: 0,
        data: {
          tenantId: 'tenant-omega',
          webhookId: 'whk-retry-test',
          idempotencyKey: 'idemp-sqs-fail-then-retry',
          url: 'https://subscriber.example.com/events',
          event: 'ticket.updated',
          payload: { ticketId: 'tkt-retry-1' },
          secret: 'whsec_test',
        } as WebhookJobPayload,
      } as unknown as Job<WebhookJobPayload>;

      // Attempt 1: Fails with SQS error
      await expect(dispatchers.processWebhook(mockJobAttempt1)).rejects.toThrow(
        'SQS Temporary Network Glitch',
      );

      // Verify idempotency key was released and is not marked as processed
      const isKeyLocked = await idempotencyStore.isProcessed('idemp-sqs-fail-then-retry');
      expect(isKeyLocked).toBe(false);

      // Attempt 2 (BullMQ retry of same job): Must NOT be skipped as duplicate
      const mockJobAttempt2 = {
        ...mockJobAttempt1,
        attemptsMade: 1,
      } as unknown as Job<WebhookJobPayload>;

      const retryResult = await dispatchers.processWebhook(mockJobAttempt2);

      // Verify retry succeeded and was not skipped
      expect(retryResult.success).toBe(true);
      expect(retryResult.skipped).toBeUndefined();
      expect(retryResult.data).toMatchObject({
        transport: 'sqs',
        messageId: 'msg-sqs-retry-success',
        deliveryId: 'idemp-sqs-fail-then-retry',
        event: 'ticket.updated',
      });

      // Verify publishToSQS was called twice (attempt 1 and attempt 2)
      expect(publishSpy).toHaveBeenCalledTimes(2);

      // Verify after successful attempt 2, idempotency key IS retained
      const isKeyLockedAfterSuccess = await idempotencyStore.isProcessed(
        'idemp-sqs-fail-then-retry',
      );
      expect(isKeyLockedAfterSuccess).toBe(true);

      // Attempt 3 (genuine duplicate after success): Must be skipped
      const mockJobAttempt3 = {
        ...mockJobAttempt1,
        attemptsMade: 2,
      } as unknown as Job<WebhookJobPayload>;

      const duplicateResult = await dispatchers.processWebhook(mockJobAttempt3);
      expect(duplicateResult.success).toBe(true);
      expect(duplicateResult.skipped).toBe(true);
      expect(duplicateResult.reason).toContain('Duplicate job skipped');
      expect(publishSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('HTTP Transport (WEBHOOK_TRANSPORT=http)', () => {
    it('signs payload with HMAC-SHA256 and dispatches direct POST request', async () => {
      process.env['WEBHOOK_TRANSPORT'] = 'http';
      const secret = 'whsec_test_secret_for_signature_123';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      vi.stubGlobal('fetch', mockFetch);

      const dispatchers = new NotificationDispatchers(idempotencyStore, logger);
      const eventPayload = { id: 'evt-1', data: 'hello' };
      const mockJob = {
        id: 'job-201',
        attemptsMade: 0,
        data: {
          tenantId: 'tenant-alpha',
          webhookId: 'whk-99',
          url: 'https://webhook.site/receiver',
          event: 'user.created',
          payload: eventPayload,
          secret,
        } as WebhookJobPayload,
      } as unknown as Job<WebhookJobPayload>;

      const result = await dispatchers.processWebhook(mockJob);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        transport: 'http',
        status: 200,
        event: 'user.created',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://webhook.site/receiver');
      expect(options.method).toBe('POST');

      // Verify HMAC-SHA256 signature
      const expectedSig = createHmac('sha256', secret)
        .update(JSON.stringify(eventPayload))
        .digest('hex');
      expect(options.headers['X-SupportPilot-Signature']).toBe(`sha256=${expectedSig}`);
      expect(options.headers['X-SupportPilot-Event']).toBe('user.created');
      expect(options.headers['X-SupportPilot-Tenant-Id']).toBe('tenant-alpha');
    });

    it('throws error when subscriber returns non-2xx status code', async () => {
      process.env['WEBHOOK_TRANSPORT'] = 'http';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      vi.stubGlobal('fetch', mockFetch);

      const dispatchers = new NotificationDispatchers(idempotencyStore, logger);
      const mockJob = {
        id: 'job-202',
        attemptsMade: 0,
        data: {
          tenantId: 'tenant-alpha',
          webhookId: 'whk-100',
          url: 'https://failing-webhook.site/receiver',
          event: 'ticket.escalated',
          payload: { ticketId: 't-999' },
          secret: 'whsec_test',
        } as WebhookJobPayload,
      } as unknown as Job<WebhookJobPayload>;

      await expect(dispatchers.processWebhook(mockJob)).rejects.toThrow(
        'Webhook HTTP delivery failed with status 500',
      );
    });

    it('releases idempotency key on HTTP delivery failure so retry attempt succeeds', async () => {
      process.env['WEBHOOK_TRANSPORT'] = 'http';

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mockFetch);

      const dispatchers = new NotificationDispatchers(idempotencyStore, logger);
      const mockJob = {
        id: 'job-http-retry-1',
        attemptsMade: 0,
        data: {
          tenantId: 'tenant-alpha',
          webhookId: 'whk-http-retry',
          idempotencyKey: 'idemp-http-fail-retry',
          url: 'https://subscriber.example.com/events',
          event: 'ticket.created',
          payload: { ticketId: 't-1' },
          secret: 'whsec_test',
        } as WebhookJobPayload,
      } as unknown as Job<WebhookJobPayload>;

      // Attempt 1 fails with 503
      await expect(dispatchers.processWebhook(mockJob)).rejects.toThrow(
        'Webhook HTTP delivery failed with status 503',
      );

      // Verify key released
      expect(await idempotencyStore.isProcessed('idemp-http-fail-retry')).toBe(false);

      // Attempt 2 succeeds
      const retryResult = await dispatchers.processWebhook({
        ...mockJob,
        attemptsMade: 1,
      } as unknown as Job<WebhookJobPayload>);

      expect(retryResult.success).toBe(true);
      expect(retryResult.skipped).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(await idempotencyStore.isProcessed('idemp-http-fail-retry')).toBe(true);
    });
  });

  describe('Idempotency Handling', () => {
    it('skips duplicate webhook job execution', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      vi.stubGlobal('fetch', mockFetch);

      const dispatchers = new NotificationDispatchers(idempotencyStore, logger);
      const mockJob = {
        id: 'job-idem-1',
        attemptsMade: 0,
        data: {
          tenantId: 'tenant-1',
          webhookId: 'whk-1',
          idempotencyKey: 'idemp-fixed-key',
          url: 'https://example.com/wh',
          event: 'ticket.created',
          payload: {},
          secret: 'secret',
        } as WebhookJobPayload,
      } as unknown as Job<WebhookJobPayload>;

      const firstResult = await dispatchers.processWebhook(mockJob);
      expect(firstResult.success).toBe(true);
      expect(firstResult.skipped).toBeUndefined();

      const secondResult = await dispatchers.processWebhook(mockJob);
      expect(secondResult.success).toBe(true);
      expect(secondResult.skipped).toBe(true);
      expect(secondResult.reason).toContain('Duplicate job skipped');
    });
  });
});
