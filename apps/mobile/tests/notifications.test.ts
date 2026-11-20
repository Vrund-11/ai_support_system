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
});
