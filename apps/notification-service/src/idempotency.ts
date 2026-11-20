import type { Redis } from 'ioredis';

export interface IdempotencyStore {
  acquire(key: string, ttlSeconds?: number): Promise<boolean>;
  release(key: string): Promise<void>;
  isProcessed(key: string): Promise<boolean>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, number>();

  async acquire(key: string, ttlSeconds = 86400): Promise<boolean> {
    const now = Date.now();
    const expiresAt = this.store.get(key);

    if (expiresAt && expiresAt > now) {
      return false; // Already acquired / processed
    }

    this.store.set(key, now + ttlSeconds * 1000);
    return true;
  }

  async release(key: string): Promise<void> {
    this.store.delete(key);
  }

  async isProcessed(key: string): Promise<boolean> {
    const now = Date.now();
    const expiresAt = this.store.get(key);
    return !!(expiresAt && expiresAt > now);
  }

  clear(): void {
    this.store.clear();
  }
}

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private redis: Redis) {}

  async acquire(key: string, ttlSeconds = 86400): Promise<boolean> {
    const result = await this.redis.set(`idempotency:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async release(key: string): Promise<void> {
    await this.redis.del(`idempotency:${key}`);
  }

  async isProcessed(key: string): Promise<boolean> {
    const exists = await this.redis.exists(`idempotency:${key}`);
    return exists === 1;
  }
}
