import { loadEnv, ticketServiceEnvSchema } from '@supportpilot/validators';
import { createLogger } from '@supportpilot/shared-lib';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './lib/mongoose.js';
import { configureAuth } from './services/auth.service.js';

const env = loadEnv(ticketServiceEnvSchema);
const logger = createLogger('ticket-service', env.LOG_LEVEL);

// Configure JWT auth with loaded environment secrets
configureAuth({
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
});

const app = createApp(env.LOG_LEVEL);

// Connect DB (non-blocking in dev if datastore is starting)
connectDb(env.MONGODB_URI, logger).catch((err) => {
  logger.error({ err }, 'Initial MongoDB connection failed; will retry automatically');
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Ticket service listening');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down gracefully...');
  server.close(async () => {
    await disconnectDb();
    logger.info('HTTP server and DB connections closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server };
