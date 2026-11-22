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
    res.status(200).json({ status: 'ok' });
  });

  const readinessHandler = (req: express.Request, res: express.Response) => {
    const isReady = true;
    const token = req.headers['x-service-token'];
    const isAuth = Boolean(token && token === config.serviceToken);

    const statusCode = isReady ? 200 : 503;
    const status = isReady ? 'ready' : 'not_ready';

    if (isAuth) {
      res.status(statusCode).json({
        status,
        dependencies: {
          queues: 'connected',
        },
      });
      return;
    }

    res.status(statusCode).json({ status });
  };

  app.get('/ready', readinessHandler);
  app.get('/health/readiness', readinessHandler);

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
