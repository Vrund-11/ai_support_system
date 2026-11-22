import type { PushProvider, PushNotificationPayload, PushResult } from './types.js';

export interface RecordedPush {
  id: string;
  payload: PushNotificationPayload;
  sentAt: string;
}

export class TestPushProvider implements PushProvider {
  public sentPushes: RecordedPush[] = [];

  clear(): void {
    this.sentPushes = [];
  }

  async sendPushNotification(payload: PushNotificationPayload): Promise<PushResult> {
    const invalidTokens: string[] = [];

    // Ensure deep link format supportpilot://ticket/:id
    const dataWithDeepLink = {
      ...payload.data,
      url:
        payload.data.url ||
        (payload.data.ticketId ? `supportpilot://ticket/${payload.data.ticketId}` : undefined),
    };

    const recordedPayload: PushNotificationPayload = {
      ...payload,
      data: dataWithDeepLink,
    };

    for (const token of payload.to) {
      if (
        token === 'invalid_stale_token' ||
        token.includes('DeviceNotRegistered') ||
        token.includes('not-registered')
      ) {
        invalidTokens.push(token);
      }
    }

    const recorded: RecordedPush = {
      id: `push_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      payload: recordedPayload,
      sentAt: new Date().toISOString(),
    };

    this.sentPushes.push(recorded);

    return {
      success: true,
      totalSent: payload.to.length - invalidTokens.length,
      invalidTokens,
      details: { id: recorded.id },
    };
  }
}

export const testPushProvider = new TestPushProvider();
