import express, { type Express } from 'express';
import { requestIdMiddleware, errorHandler, type Logger } from '@supportpilot/shared-lib';
import type { QueueManager } from './manager.js';
import { createNotificationRoutes } from './routes/notification.routes.js';
import { createDlqRoutes } from './routes/dlq.routes.js';

export interface AppConfig {
  queueManager: QueueManager;
  logger: Logger;
  serviceToken: string;
}

export function createApp(config: AppConfig): Express {
  const app = express();

  app.use(express.json());
  app.use(requestIdMiddleware);

  // Health and ready probes
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    res.json({
      status: 'ready',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routes
  app.use('/api/v1/notifications/dlq', createDlqRoutes(config.queueManager, config.serviceToken));
  app.use(
    '/api/v1/notifications',
    createNotificationRoutes(config.queueManager, config.serviceToken),
  );

  // Error handler
  app.use(errorHandler(config.logger));

  return app;
}
