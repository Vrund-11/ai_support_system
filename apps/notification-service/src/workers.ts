import type { Job } from 'bullmq';
import type { Logger } from '@supportpilot/shared-lib';
import type {
  EmailJobPayload,
  PushJobPayload,
  WebhookJobPayload,
  SlaJobPayload,
  AuditJobPayload,
  DeadLetterPayload,
} from './types.js';
import type { IdempotencyStore } from './idempotency.js';

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
      'Sending transactional email',
    );

    // Mock dispatch (e.g. Resend / SMTP MailHog)
    return { success: true, data: { to: payload.to, sentAt: new Date().toISOString() } };
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

    // Mock dispatch (e.g. Firebase Cloud Messaging)
    return {
      success: true,
      data: { userId: payload.userId, deliveredAt: new Date().toISOString() },
    };
  }

  async processWebhook(job: Job<WebhookJobPayload>): Promise<DispatchHandlerResult> {
    const payload = job.data;
    const key = payload.idempotencyKey || `webhook:${job.id || Date.now()}`;

    if (!(await this.checkIdempotency(key))) {
      return { success: true, skipped: true, reason: 'Duplicate job skipped' };
    }

    this.logger.info(
      { url: payload.url, event: payload.event, tenantId: payload.tenantId },
      'Delivering signed webhook',
    );

    // Mock delivery
    return { success: true, data: { event: payload.event, status: 200 } };
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
