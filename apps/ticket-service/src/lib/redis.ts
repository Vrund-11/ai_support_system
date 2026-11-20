import { Redis } from 'ioredis';
import type { Logger } from '@supportpilot/shared-lib';

let client: Redis | null = null;

/** Connect to Redis. Call once at startup. */
export function connectRedis(url: string, logger: Logger): Redis {
  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting');
      return delay;
    },
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err: Error) => logger.error({ err }, 'Redis error'));

  return client;
}

/** Get existing Redis client. Throws if not connected. */
export function getRedis(): Redis {
  if (!client) throw new Error('Redis not connected — call connectRedis first');
  return client;
}

/** Disconnect Redis. */
export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
