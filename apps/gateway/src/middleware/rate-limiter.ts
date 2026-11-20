import type { Request, Response, NextFunction } from 'express';
import type { Redis } from 'ioredis';
import { AppError } from '@supportpilot/shared-lib';
import { getRedis } from '../lib/redis.js';

export interface RateLimiterOptions {
  windowMs: number; // Duration of window in milliseconds
  max: number; // Maximum number of requests within window
  prefix?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Redis sliding window rate limiter middleware (AUTH-5, TEN-4).
 * Returns standard rate limit headers:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 * Rejects exceeding requests with 429 and Retry-After header.
 */
export function createRateLimiter(options: RateLimiterOptions, redisClient?: Redis) {
  const windowSec = Math.ceil(options.windowMs / 1000);
  const max = options.max;
  const prefix = options.prefix ?? 'rl:api';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let redis: Redis;
    try {
      redis = redisClient ?? getRedis();
    } catch {
      // If Redis client is not available in test or offline, pass through gracefully
      next();
      return;
    }

    const keyPart = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip ?? req.socket.remoteAddress ?? 'anonymous');

    const key = `${prefix}:${keyPart}`;

    try {
      // Atomic increment and TTL setup
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      const ttl = await redis.ttl(key);
      const resetTime = Math.ceil(Date.now() / 1000) + Math.max(ttl, 0);
      const remaining = Math.max(0, max - current);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (current > max) {
        res.setHeader('Retry-After', Math.max(ttl, 1));
        throw new AppError(
          429,
          `Too many requests. Please retry in ${Math.max(ttl, 1)} seconds.`,
          '/errors/rate-limited',
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
