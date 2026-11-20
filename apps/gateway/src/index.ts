import { loadEnv, gatewayEnvSchema } from '@supportpilot/validators';
import { createLogger } from '@supportpilot/shared-lib';
import { createApp } from './app.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';

const env = loadEnv(gatewayEnvSchema);
const logger = createLogger('gateway', env.LOG_LEVEL);

const redis = connectRedis(env.REDIS_URL, logger);

const app = createApp({
  logLevel: env.LOG_LEVEL,
  ticketServiceUrl: env.TICKET_SERVICE_URL,
  serviceToken: env.SERVICE_TOKEN,
  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  redisClient: redis,
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Gateway listening');
});

async function shutdown(): Promise<void> {
  logger.info('Gateway shutting down gracefully');
  server.close(async () => {
    await disconnectRedis();
    logger.info('Gateway stopped');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

export { app };
