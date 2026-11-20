import express, { type Express } from 'express';
import {
  createLogger,
  requestIdMiddleware,
  errorHandler,
  createMetricsMiddleware,
  createMetricsHandler,
  createTraceMiddleware,
} from '@supportpilot/shared-lib';
import { isDbConnected } from './lib/mongoose.js';
import { authRouter } from './routes/auth.routes.js';
import { ticketRouter } from './routes/ticket.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { kbRouter } from './routes/kb.routes.js';
import { userRouter } from './routes/user.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { ruleRouter } from './routes/rule.routes.js';
import { integrationRouter } from './routes/integration.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { customerRouter } from './routes/customer.routes.js';
import { teamRouter } from './routes/team.routes.js';
import { docsRouter } from './routes/docs.routes.js';
import { createQuotaMiddleware } from './middleware/quota.middleware.js';

export function createApp(logLevel: string = 'info'): Express {
  const logger = createLogger('ticket-service', logLevel);
  const app: Express = express();

  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(createTraceMiddleware('ticket-service'));
  app.use(createMetricsMiddleware('ticket-service'));

  // ── Metrics endpoint (Prometheus) ──
  app.get('/metrics', createMetricsHandler());

  // ── Liveness probe ──
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'ticket-service',
      timestamp: new Date().toISOString(),
    });
  });

  // ── Readiness probe ──
  app.get('/ready', (_req, res) => {
    const connected = isDbConnected();
    if (connected) {
      res.status(200).json({
        status: 'ready',
        db: 'connected',
      });
      return;
    }

    res.status(503).json({
      status: 'not ready',
      db: 'disconnected',
    });
  });

  // ── Tenant quota tracking (TEN-4) ──
  app.use('/api/v1', createQuotaMiddleware());

  // ── API routes ──
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/tickets', ticketRouter);
  app.use('/api/v1/uploads', uploadRouter);
  app.use('/api/v1/kb', kbRouter);
  app.use('/api/v1/customers', customerRouter);
  app.use('/api/v1/team', teamRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/rules', ruleRouter);
  app.use('/api/v1/docs', docsRouter);
  app.use('/api/v1', integrationRouter);
  app.use('/api/v1/admin', adminRouter);

  // ── Error handler (must be last) ──
  app.use(errorHandler(logger));

  return app;
}
