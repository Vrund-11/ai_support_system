import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpoPushProvider } from '../src/push/expo-provider.js';
import { testPushProvider } from '../src/push/test-provider.js';
import { NotificationDispatchers } from '../src/workers.js';
import { MemoryIdempotencyStore } from '../src/idempotency.js';
import { createLogger } from '@supportpilot/shared-lib';

describe('Feature 42: Production Push Notification Provider & Invalid Token Cleanup', () => {
  beforeEach(() => {
    testPushProvider.clear();
    vi.restoreAllMocks();
  });

  describe('TestPushProvider', () => {
    it('dispatches push notification and ensures deep link format supportpilot://ticket/:id', async () => {
      const result = await testPushProvider.sendPushNotification({
        to: ['ExponentPushToken[user_agent_1]'],
        title: 'New Ticket Assigned',
        body: 'Ticket #1001 SAML SSO Error assigned to you.',
        data: {
          type: 'ticket_assigned',
          ticketId: 'tkt_1001',
          tenantId: '507f1f77bcf86cd799439011',
        },
      });

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(1);
      expect(result.invalidTokens).toEqual([]);
      expect(testPushProvider.sentPushes.length).toBe(1);

      const recorded = testPushProvider.sentPushes[0]!;
      expect(recorded.payload.data.url).toBe('supportpilot://ticket/tkt_1001');
    });

    it('identifies invalid or unregistered device tokens for cleanup', async () => {
      const result = await testPushProvider.sendPushNotification({
        to: ['ExponentPushToken[valid_token]', 'invalid_stale_token'],
        title: 'SLA Warning',
        body: 'First response due in 15 minutes.',
        data: {
          type: 'sla_warning',
          ticketId: 'tkt_1002',
          tenantId: '507f1f77bcf86cd799439011',
        },
      });

      expect(result.success).toBe(true);
      expect(result.totalSent).toBe(1);
      expect(result.invalidTokens).toEqual(['invalid_stale_token']);
    });
  });

  describe('ExpoPushProvider', () => {
    it('sends HTTP POST to Expo API and extracts DeviceNotRegistered error tokens', async () => {
      const mockExpoResponse = {
        data: [
          { status: 'ok', id: 'ticket_uuid_1' },
          {
            status: 'error',
            message: 'DeviceNotRegistered',
            details: { error: 'DeviceNotRegistered' },
          },
        ],
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockExpoResponse,
      } as any);

      const provider = new ExpoPushProvider('test_access_token');
      const result = await provider.sendPushNotification({
        to: ['ExponentPushToken[valid]', 'ExponentPushToken[stale]'],
        title: 'Customer Message',
        body: 'New reply from user.',
        data: {
          type: 'customer_message',
          ticketId: 'tkt_1003',
          tenantId: '507f1f77bcf86cd799439011',
        },
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_access_token',
          }),
        }),
      );

      expect(result.totalSent).toBe(1);
      expect(result.invalidTokens).toEqual(['ExponentPushToken[stale]']);
    });
  });

  describe('NotificationDispatchers processPush integration', () => {
    it('processes push job and returns delivery stats', async () => {
      const idempotency = new MemoryIdempotencyStore();
      const logger = createLogger('notification-service-test', 'silent');
      const dispatchers = new NotificationDispatchers(idempotency, logger);

      const job = {
        id: 'job_push_99',
        data: {
          tenantId: '507f1f77bcf86cd799439011',
          userId: 'user_456',
          tokens: ['ExponentPushToken[active]'],
          title: 'Ticket Priority Changed',
          body: 'Ticket #1004 elevated to URGENT.',
          data: {
            ticketId: 'tkt_1004',
          },
        },
      };

      const result = await dispatchers.processPush(job as any);
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        userId: 'user_456',
        totalSent: 1,
        invalidTokens: [],
      });
    });
  });
});
