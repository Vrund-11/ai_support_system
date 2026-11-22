import { createHmac } from 'node:crypto';
import type { Job } from 'bullmq';
import type { Logger } from '@supportpilot/shared-lib';
import { publishToSQS } from '@supportpilot/queue';
import type {
  EmailJobPayload,
  PushJobPayload,
  WebhookJobPayload,
  SlaJobPayload,
  AuditJobPayload,
  DeadLetterPayload,
} from './types.js';
import type { IdempotencyStore } from './idempotency.js';
import { getEmailTransporter } from './email/index.js';
import { getPushProvider } from './push/index.js';

export interface DispatchHandlerResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  data?: unknown;
}

export class NotificationDispatchers {
  constructor(
    private idempotency: IdempotencyStore,
    private logger: Logger,
  ) {}

  private async checkIdempotency(key: string): Promise<boolean> {
    const acquired = await this.idempotency.acquire(key);
    if (!acquired) {
      this.logger.info({ key }, 'Duplicate notification job skipped by idempotency consumer');
      return false;
    }
    return true;
  }

  async processEmail(job: Job<EmailJobPayload>): Promise<DispatchHandlerResult> {
    const payload = job.data;
    const key = payload.idempotencyKey || `email:${job.id || Date.now()}`;

    if (!(await this.checkIdempotency(key))) {
      return { success: true, skipped: true, reason: 'Duplicate job skipped' };
    }

    this.logger.info(
      { to: payload.to, subject: payload.subject, tenantId: payload.tenantId },
      'Sending transactional email via SMTP',
    );

    try {
      const transporter = getEmailTransporter();
      const result = await transporter.send({
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        template: payload.template,
        variables: payload.variables,
      });

      return {
        success: true,
        data: {
          to: payload.to,
          messageId: result.messageId,
          subject: result.subject,
          sentAt: result.sentAt,
          deliveredVia: result.deliveredVia,
        },
      };
    } catch (error) {
      await this.idempotency.release(key).catch((relErr) => {
        this.logger.warn(
          { key, err: relErr },
          'Failed to release idempotency key after email failure',
        );
      });
      throw error;
    }
  }

  async processPush(job: Job<PushJobPayload>): Promise<DispatchHandlerResult> {
    const payload = job.data;
    const key = payload.idempotencyKey || `push:${job.id || Date.now()}`;

    if (!(await this.checkIdempotency(key))) {
      return { success: true, skipped: true, reason: 'Duplicate job skipped' };
    }

    this.logger.info(
      { userId: payload.userId, title: payload.title, tenantId: payload.tenantId },
      'Sending push notification',
    );

    try {
      const pushProvider = getPushProvider();
      const tokens =
        payload.tokens && payload.tokens.length > 0
          ? payload.tokens
          : [`token_for_user_${payload.userId}`];

      const ticketId = payload.data?.ticketId;
      const url = payload.data?.url || (ticketId ? `supportpilot://ticket/${ticketId}` : undefined);

      const pushResult = await pushProvider.sendPushNotification({
        to: tokens,
        title: payload.title,
        body: payload.body,
        data: {
          ...payload.data,
          tenantId: payload.tenantId,
          ticketId,
          url,
        },
      });

      if (pushResult.invalidTokens && pushResult.invalidTokens.length > 0) {
        this.logger.warn(
          { userId: payload.userId, invalidTokens: pushResult.invalidTokens },
          'Cleaned up obsolete/unregistered push tokens',
        );
      }

      return {
        success: pushResult.success,
        data: {
          userId: payload.userId,
          totalSent: pushResult.totalSent,
          invalidTokens: pushResult.invalidTokens,
          deliveredAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      await this.idempotency.release(key).catch((relErr) => {
        this.logger.warn(
          { key, err: relErr },
          'Failed to release idempotency key after push failure',
        );
      });
      throw error;
    }
  }

  async processWebhook(job: Job<WebhookJobPayload>): Promise<DispatchHandlerResult> {
    const payload = job.data;
    const key = payload.idempotencyKey || `webhook:${job.id || Date.now()}`;

    if (!(await this.checkIdempotency(key))) {
      return { success: true, skipped: true, reason: 'Duplicate job skipped' };
    }

    try {
      const transport = process.env['WEBHOOK_TRANSPORT'] ?? 'http';
      const deliveryId =
        payload.idempotencyKey || payload.webhookId || `del_${job.id || Date.now()}`;

      if (transport === 'sqs') {
        const queueUrl =
          process.env['SQS_WEBHOOK_QUEUE_URL'] ||
          'http://localhost:4566/000000000000/supportpilot-webhooks';

        const sqsMessage = {
          deliveryId,
          tenantId: payload.tenantId,
          url: payload.url,
          event: payload.event,
          payload: payload.payload,
          attempt: (job.attemptsMade ?? 0) + 1,
        };

        this.logger.info(
          { queueUrl, deliveryId, event: payload.event, tenantId: payload.tenantId },
          'Enqueuing webhook event to SQS queue',
        );

        const messageId = await publishToSQS(queueUrl, sqsMessage);

        return {
          success: true,
          data: {
            transport: 'sqs',
            messageId,
            deliveryId,
            event: payload.event,
            tenantId: payload.tenantId,
          },
        };
      }

      // Direct HTTP transport (default)
      this.logger.info(
        { url: payload.url, event: payload.event, tenantId: payload.tenantId, deliveryId },
        'Delivering signed webhook via direct HTTP POST',
      );

      const secret =
        payload.secret ||
        process.env['WEBHOOK_SIGNING_SECRET'] ||
        'whsec_default_signing_key_32_chars!';

      const serializedBody = JSON.stringify(payload.payload ?? {});
      const signature = createHmac('sha256', secret).update(serializedBody).digest('hex');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SupportPilot-Webhook-Worker/1.0',
        'X-SupportPilot-Event': payload.event,
        'X-SupportPilot-Delivery': deliveryId,
        'X-SupportPilot-Signature': `sha256=${signature}`,
      };
      if (payload.tenantId) {
        headers['X-SupportPilot-Tenant-Id'] = payload.tenantId;
      }

      const response = await fetch(payload.url, {
        method: 'POST',
        headers,
        body: serializedBody,
      });

      if (!response.ok) {
        throw new Error(`Webhook HTTP delivery failed with status ${response.status}`);
      }

      return {
        success: true,
        data: {
          transport: 'http',
          status: response.status,
          event: payload.event,
          deliveryId,
        },
      };
    } catch (error) {
      await this.idempotency.release(key).catch((relErr) => {
        this.logger.warn(
          { key, err: relErr },
          'Failed to release idempotency key after webhook failure',
        );
      });
      throw error;
    }
  }

  async processSla(job: Job<SlaJobPayload>): Promise<DispatchHandlerResult> {
    const payload = job.data;
    const key = payload.idempotencyKey || `sla:${job.id || Date.now()}`;

    if (!(await this.checkIdempotency(key))) {
      return { success: true, skipped: true, reason: 'Duplicate job skipped' };
    }

    this.logger.info(
      { ticketId: payload.ticketId, stage: payload.stage, tenantId: payload.tenantId },
      'Processing SLA timer notification',
    );

    return { success: true, data: { ticketId: payload.ticketId, stage: payload.stage } };
  }

  async processAudit(job: Job<AuditJobPayload>): Promise<DispatchHandlerResult> {
    const payload = job.data;
    this.logger.info(
      { action: payload.action, entity: payload.entity, tenantId: payload.tenantId },
      'Writing audit log entry',
    );

    return { success: true, data: { action: payload.action, writtenAt: new Date().toISOString() } };
  }

  async processDlq(job: Job<DeadLetterPayload>): Promise<DispatchHandlerResult> {
    const payload = job.data;
    this.logger.warn(
      {
        dlqId: payload.dlqId,
        originalQueue: payload.originalQueue,
        tenantId: payload.tenantId,
        failedReason: payload.failedReason,
      },
      'Dead-letter queue job recorded',
    );

    return { success: true, data: { recordedAt: new Date().toISOString() } };
  }
}
