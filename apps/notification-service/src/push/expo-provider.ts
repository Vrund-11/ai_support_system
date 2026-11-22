import type { PushProvider, PushNotificationPayload, PushResult } from './types.js';

export class ExpoPushProvider implements PushProvider {
  private readonly accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env['EXPO_ACCESS_TOKEN'];
  }

  async sendPushNotification(payload: PushNotificationPayload): Promise<PushResult> {
    if (!payload.to || payload.to.length === 0) {
      return { success: true, totalSent: 0, invalidTokens: [] };
    }

    const messages = payload.to.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: {
        ...payload.data,
        url:
          payload.data.url ||
          (payload.data.ticketId ? `supportpilot://ticket/${payload.data.ticketId}` : undefined),
      },
      sound: 'default',
    }));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      const json = (await response.json()) as any;
      const invalidTokens: string[] = [];

      if (json && Array.isArray(json.data)) {
        json.data.forEach((ticket: any, index: number) => {
          if (
            ticket.status === 'error' &&
            (ticket.details?.error === 'DeviceNotRegistered' ||
              ticket.message?.includes('DeviceNotRegistered') ||
              ticket.details?.error === 'messaging/registration-token-not-registered')
          ) {
            const token = payload.to[index];
            if (token) invalidTokens.push(token);
          }
        });
      }

      return {
        success: response.ok,
        totalSent: payload.to.length - invalidTokens.length,
        invalidTokens,
        details: json,
      };
    } catch (err: any) {
      return {
        success: false,
        totalSent: 0,
        invalidTokens: [],
        details: err.message,
      };
    }
  }
}
