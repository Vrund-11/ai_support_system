import { secureStorage } from './storage.js';

export interface DeepLinkRoute {
  screen: 'ticket' | 'inbox' | 'notifications' | 'unknown';
  params?: Record<string, string>;
}

export class NotificationService {
  private deviceTokenKey = 'supportpilot_fcm_device_token';

  /**
   * Parse inbound deep links (MOB-4, NOTIF-2).
   * Supports `supportpilot://ticket/:id` and web links `https://app.supportpilot.dev/ticket/:id`.
   */
  parseDeepLink(url: string): DeepLinkRoute {
    try {
      // Normalise scheme
      const cleanUrl = url.replace('supportpilot://', 'https://supportpilot.local/');
      const parsed = new URL(cleanUrl);

      const pathParts = parsed.pathname.replace(/^\//, '').split('/');
      const [first, second] = pathParts;

      if (first === 'ticket' && second) {
        return { screen: 'ticket', params: { id: second } };
      }
      if (first === 'inbox') {
        return { screen: 'inbox' };
      }
      if (first === 'notifications') {
        return { screen: 'notifications' };
      }
      return { screen: 'unknown' };
    } catch {
      return { screen: 'unknown' };
    }
  }

  /**
   * Register push notification token with backend (NOTIF-2, MOB-4).
   */
  async registerDeviceToken(
    token: string,
    registerApiFn?: (token: string) => Promise<boolean>,
  ): Promise<boolean> {
    await secureStorage.setItem(this.deviceTokenKey, token);

    if (registerApiFn) {
      try {
        return await registerApiFn(token);
      } catch {
        return false;
      }
    }
    return true;
  }

  async getStoredDeviceToken(): Promise<string | null> {
    return secureStorage.getItem(this.deviceTokenKey);
  }
}

export const notificationService = new NotificationService();
