import express, { type Express } from 'express';
import { createLogger, requestIdMiddleware, errorHandler } from '@supportpilot/shared-lib';
import { loadEnv, notificationServiceEnvSchema } from '@supportpilot/validators';

const env = loadEnv(notificationServiceEnvSchema);
const logger = createLogger('notification-service', env.LOG_LEVEL);
const app: Express = express();

app.use(express.json());
app.use(requestIdMiddleware);

// ── Health ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

app.get('/ready', (_req, res) => {
  // TODO: check Redis + Postgres connection
  res.json({ status: 'ready' });
});

// ── Error handler (must be last) ──
app.use(errorHandler(logger));

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Notification service listening');
});

export { app };
