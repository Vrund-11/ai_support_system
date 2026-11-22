export interface PushNotificationPayload {
  to: string[];
  title: string;
  body: string;
  data: {
    type?: string;
    ticketId?: string;
    tenantId?: string;
    url?: string;
    [key: string]: string | undefined;
  };
}

export interface PushResult {
  success: boolean;
  totalSent: number;
  invalidTokens: string[];
  details?: unknown;
}

export interface PushProvider {
  sendPushNotification(payload: PushNotificationPayload): Promise<PushResult>;
}
