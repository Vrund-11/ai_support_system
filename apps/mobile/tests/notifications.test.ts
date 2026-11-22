import { describe, it, expect, beforeEach } from 'vitest';
import { notificationService } from '../src/lib/notifications.js';
import { secureStorage } from '../src/lib/storage.js';

describe('Push Notifications & Deep Linking (MOB-4, NOTIF-2)', () => {
  beforeEach(async () => {
    await secureStorage.clear();
  });

  it('parses custom scheme deep links for tickets and navigation', () => {
    const routeTicket = notificationService.parseDeepLink('supportpilot://ticket/tkt_998');
    expect(routeTicket.screen).toBe('ticket');
    expect(routeTicket.params?.id).toBe('tkt_998');

    const routeInbox = notificationService.parseDeepLink('supportpilot://inbox');
    expect(routeInbox.screen).toBe('inbox');

    const routeAlerts = notificationService.parseDeepLink('supportpilot://notifications');
    expect(routeAlerts.screen).toBe('notifications');

    const invalid = notificationService.parseDeepLink('invalid://unknown/path');
    expect(invalid.screen).toBe('unknown');
  });

  it('registers FCM device token and persists in secure storage', async () => {
    let apiCalled = false;
    const mockRegisterApi = async (token: string) => {
      apiCalled = true;
      return token === 'fcm_sample_device_token';
    };

    const success = await notificationService.registerDeviceToken(
      'fcm_sample_device_token',
      mockRegisterApi,
    );

    expect(success).toBe(true);
    expect(apiCalled).toBe(true);
    expect(await notificationService.getStoredDeviceToken()).toBe('fcm_sample_device_token');
  });

  it('routes notification response with url payload to ticket screen', () => {
    const route = notificationService.handleNotificationResponse({
      type: 'ticket_reply',
      ticketId: 'tkt_555',
      tenantId: 'tenant_acme',
      url: 'supportpilot://ticket/tkt_555',
    });

    expect(route.screen).toBe('ticket');
    expect(route.params?.id).toBe('tkt_555');
  });

  it('routes notification response fallback with ticketId when url is omitted', () => {
    const route = notificationService.handleNotificationResponse({
      ticketId: 'tkt_777',
      tenantId: 'tenant_acme',
    });

    expect(route.screen).toBe('ticket');
    expect(route.params?.id).toBe('tkt_777');
  });

  it('handles token refresh idempotently without re-registering identical token', async () => {
    let callCount = 0;
    const mockRegister = async () => {
      callCount++;
      return true;
    };

    // First registration
    await notificationService.registerDeviceToken('token_initial', mockRegister);
    expect(callCount).toBe(1);

    // Refresh with identical token -> no api call
    const sameResult = await notificationService.handleTokenRefresh('token_initial', mockRegister);
    expect(sameResult).toBe(true);
    expect(callCount).toBe(1);

    // Refresh with new token -> registers new token
    const newResult = await notificationService.handleTokenRefresh('token_updated', mockRegister);
    expect(newResult).toBe(true);
    expect(callCount).toBe(2);
    expect(await notificationService.getStoredDeviceToken()).toBe('token_updated');
  });
});
