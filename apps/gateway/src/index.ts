import express, { type Express } from 'express';
import { createLogger, requestIdMiddleware, errorHandler } from '@supportpilot/shared-lib';
import { loadEnv, gatewayEnvSchema } from '@supportpilot/validators';

const env = loadEnv(gatewayEnvSchema);
const logger = createLogger('gateway', env.LOG_LEVEL);
const app: Express = express();

app.use(express.json());
app.use(requestIdMiddleware);

// ── Health ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

app.get('/ready', (_req, res) => {
  // TODO: check Redis connection
  res.json({ status: 'ready' });
});

// ── Error handler (must be last) ──
app.use(errorHandler(logger));

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Gateway listening');
});

export { app };
