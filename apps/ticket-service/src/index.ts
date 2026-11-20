import express, { type Express } from 'express';
import { createLogger, requestIdMiddleware, errorHandler } from '@supportpilot/shared-lib';
import { loadEnv, ticketServiceEnvSchema } from '@supportpilot/validators';

const env = loadEnv(ticketServiceEnvSchema);
const logger = createLogger('ticket-service', env.LOG_LEVEL);
const app: Express = express();

app.use(express.json());
app.use(requestIdMiddleware);

// ── Health ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ticket-service', timestamp: new Date().toISOString() });
});

app.get('/ready', (_req, res) => {
  // TODO: check MongoDB connection
  res.json({ status: 'ready' });
});

// ── Error handler (must be last) ──
app.use(errorHandler(logger));

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Ticket service listening');
});

export { app };
