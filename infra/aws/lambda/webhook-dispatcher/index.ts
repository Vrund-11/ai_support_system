import crypto from 'node:crypto';
import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';

export interface WebhookPayload {
  tenantId: string;
  eventId: string;
  event: string;
  targetUrl: string;
  secret?: string;
  payload: Record<string, unknown>;
  timestamp?: string;
}

export function signPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export async function deliverWebhook(
  data: WebhookPayload,
  timeoutMs: number = 5000,
): Promise<void> {
  const timestamp = data.timestamp || new Date().toISOString();
  const serializedBody = JSON.stringify(data.payload);
  const secret = data.secret || process.env['WEBHOOK_DEFAULT_SECRET'] || 'default-webhook-secret';
  const signature = signPayload(serializedBody, secret);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(data.targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SupportPilot-Webhook-Dispatcher/1.0',
        'x-supportpilot-event': data.event,
        'x-supportpilot-tenant-id': data.tenantId,
        'x-supportpilot-delivery': data.eventId,
        'x-supportpilot-timestamp': timestamp,
        'x-supportpilot-signature': `sha256=${signature}`,
      },
      body: serializedBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Webhook target responded with HTTP ${response.status}: ${response.statusText}`,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const data: WebhookPayload = JSON.parse(record.body);

      if (!data.tenantId || !data.targetUrl || !data.event) {
        throw new Error(
          `Invalid webhook payload: missing required fields in message ${record.messageId}`,
        );
      }

      await deliverWebhook(data);
    } catch (err) {
      console.error(`Failed to dispatch webhook for SQS message ${record.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
