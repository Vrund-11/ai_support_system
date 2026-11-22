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

  /**
   * Handle incoming push notification interaction payload (e.g. from NotificationResponse).
   */
  handleNotificationResponse(data: {
    type?: string;
    ticketId?: string;
    tenantId?: string;
    url?: string;
  }): DeepLinkRoute {
    if (data.url) {
      return this.parseDeepLink(data.url);
    }
    if (data.ticketId) {
      return { screen: 'ticket', params: { id: data.ticketId } };
    }
    if (data.type === 'inbox') {
      return { screen: 'inbox' };
    }
    return { screen: 'unknown' };
  }

  /**
   * Handle token refresh idempotency (only re-registers if token changed).
   */
  async handleTokenRefresh(
    newToken: string,
    registerApiFn?: (token: string) => Promise<boolean>,
  ): Promise<boolean> {
    const current = await this.getStoredDeviceToken();
    if (current === newToken) {
      return true;
    }
    return this.registerDeviceToken(newToken, registerApiFn);
  }
}

export const notificationService = new NotificationService();
