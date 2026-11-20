export type NotificationQueueName = 'email' | 'push' | 'webhook' | 'sla' | 'audit' | 'dlq';

export interface BaseJobPayload {
  tenantId: string;
  idempotencyKey?: string;
  createdAt?: string;
}

export interface EmailJobPayload extends BaseJobPayload {
  to: string;
  subject: string;
  body: string;
  template?: string;
  variables?: Record<string, unknown>;
}

export interface PushJobPayload extends BaseJobPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface WebhookJobPayload extends BaseJobPayload {
  webhookId: string;
  url: string;
  event: string;
  payload: Record<string, unknown>;
  secret: string;
}

export interface SlaJobPayload extends BaseJobPayload {
  ticketId: string;
  policyId: string;
  stage: '75_PERCENT' | '100_PERCENT';
  dueAt: string;
}

export interface AuditJobPayload extends BaseJobPayload {
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  ip?: string;
  details?: Record<string, unknown>;
}

export interface DeadLetterPayload {
  dlqId: string;
  originalQueue: NotificationQueueName;
  originalJobId?: string;
  tenantId: string;
  payload: unknown;
  failedReason: string;
  attemptsMade: number;
  failedAt: string;
}

export interface QueueMetrics {
  queue: NotificationQueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
