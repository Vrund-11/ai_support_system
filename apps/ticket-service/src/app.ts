import express, { type Express } from 'express';
import { createLogger, requestIdMiddleware, errorHandler } from '@supportpilot/shared-lib';
import { isDbConnected } from './lib/mongoose.js';
import { authRouter } from './routes/auth.routes.js';
import { ticketRouter } from './routes/ticket.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { kbRouter } from './routes/kb.routes.js';

export function createApp(logLevel: string = 'info'): Express {
  const logger = createLogger('ticket-service', logLevel);
  const app: Express = express();

  app.use(express.json());
  app.use(requestIdMiddleware);

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

  // ── API routes ──
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/tickets', ticketRouter);
  app.use('/api/v1/uploads', uploadRouter);
  app.use('/api/v1/kb', kbRouter);

  // ── Error handler (must be last) ──
  app.use(errorHandler(logger));

  return app;
}
