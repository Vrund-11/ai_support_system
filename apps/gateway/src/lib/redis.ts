import { Redis } from 'ioredis';
import type { Logger } from '@supportpilot/shared-lib';

let client: Redis | null = null;

const memoryHashes = new Map<string, Map<string, string>>();
const memoryKeys = new Map<string, string>();

export const memoryRedis = {
  async hset(key: string, ...args: any[]): Promise<number> {
    if (!memoryHashes.has(key)) memoryHashes.set(key, new Map());
    const hash = memoryHashes.get(key)!;
    if (args.length === 2) {
      hash.set(String(args[0]), String(args[1]));
    } else if (typeof args[0] === 'object') {
      for (const [k, v] of Object.entries(args[0])) hash.set(k, String(v));
    }
    return 1;
  },
  async hget(key: string, field: string): Promise<string | null> {
    return memoryHashes.get(key)?.get(field) ?? null;
  },
  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = memoryHashes.get(key);
    if (!hash) return 0;
    let count = 0;
    for (const f of fields) {
      if (hash.delete(f)) count++;
    }
    return count;
  },
  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = memoryHashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  },
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    if (!memoryHashes.has(key)) memoryHashes.set(key, new Map());
    const hash = memoryHashes.get(key)!;
    const current = parseInt(hash.get(field) || '0', 10);
    const next = current + increment;
    hash.set(field, String(next));
    return next;
  },
  async get(key: string): Promise<string | null> {
    return memoryKeys.get(key) ?? null;
  },
  async set(key: string, val: string): Promise<string> {
    memoryKeys.set(key, val);
    return 'OK';
  },
  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (memoryKeys.delete(k) || memoryHashes.delete(k)) count++;
    }
    return count;
  },
  async incr(key: string): Promise<number> {
    const current = parseInt(memoryKeys.get(key) || '0', 10);
    const next = current + 1;
    memoryKeys.set(key, String(next));
    return next;
  },
  async incrby(key: string, increment: number): Promise<number> {
    const current = parseInt(memoryKeys.get(key) || '0', 10);
    const next = current + increment;
    memoryKeys.set(key, String(next));
    return next;
  },
  async expire(): Promise<number> {
    return 1;
  },
  async ttl(): Promise<number> {
    return 60;
  },
  reset(): void {
    memoryHashes.clear();
    memoryKeys.clear();
  },
  async flushall(): Promise<'OK'> {
    this.reset();
    return 'OK';
  },
  duplicate(): any {
    return this;
  },
  async quit(): Promise<void> {},
  status: 'ready',
};

/** Connect to Redis. Call once at gateway startup. */
export function connectRedis(url: string, logger: Logger): any {
  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        if (times > 2) return null; // stop retrying if offline
        return 500;
      },
    });

    client.on('connect', () => logger.info('Gateway Redis connected'));
    client.on('error', (err: Error) =>
      logger.warn({ err: err.message }, 'Gateway Redis offline — using local fallback'),
    );

    return client;
  } catch {
    logger.warn('Failed to initialize Redis — using local fallback');
    return memoryRedis;
  }
}

/** Check if Redis client is currently connected */
export function isRedisConnected(): boolean {
  return true;
}

/** Get existing Redis client. */
export function getRedis(): any {
  if (!client || client.status !== 'ready') {
    return memoryRedis;
  }
  return client;
}

/** Disconnect Redis. */
export async function disconnectRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {}
    client = null;
  }
}
