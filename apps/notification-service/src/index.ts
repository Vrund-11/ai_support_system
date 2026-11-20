import { createLogger } from '@supportpilot/shared-lib';
import { loadEnv, notificationServiceEnvSchema } from '@supportpilot/validators';
import { MemoryIdempotencyStore } from './idempotency.js';
import { QueueManager } from './manager.js';
import { createApp } from './app.js';

const env = loadEnv(notificationServiceEnvSchema);
const logger = createLogger('notification-service', env.LOG_LEVEL);

const idempotencyStore = new MemoryIdempotencyStore();

const queueManager = new QueueManager({
  connection: { host: 'localhost', port: 6379 },
  idempotencyStore,
  logger,
  enableWorkers: true,
});

const app = createApp({
  queueManager,
  logger,
  serviceToken: env.SERVICE_TOKEN,
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Notification service listening with BullMQ queues');
  });
}

export { app, queueManager };
