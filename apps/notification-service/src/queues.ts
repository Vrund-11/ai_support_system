import type { JobsOptions } from 'bullmq';
import type { NotificationQueueName } from './types.js';

export const QUEUE_NAMES: NotificationQueueName[] = [
  'email',
  'push',
  'webhook',
  'sla',
  'audit',
  'dlq',
];

export const DEFAULT_QUEUE_OPTIONS: Record<NotificationQueueName, JobsOptions> = {
  email: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
  push: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
  webhook: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
  sla: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
  audit: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 500,
    },
    removeOnComplete: { count: 5000 },
    removeOnFail: false,
  },
  dlq: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
};
