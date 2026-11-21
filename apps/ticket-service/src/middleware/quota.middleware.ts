import type { Request, Response, NextFunction } from 'express';
import type { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { AppError } from '@supportpilot/shared-lib';
import { getRedis } from '../lib/redis.js';

export interface QuotaLimits {
  messages: number;
  ai: number;
  kb: number; // in bytes
}

export const PLAN_QUOTAS: Record<'FREE' | 'PRO', QuotaLimits> = {
  FREE: {
    messages: 500,
    ai: 50,
    kb: 10 * 1024 * 1024, // 10MB
  },
  PRO: {
    messages: 10000,
    ai: 1000,
    kb: 100 * 1024 * 1024, // 100MB
  },
};

export class TenantQuotaTracker {
  private static inMemoryStore: Map<string, number> = new Map();

  static getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  static getRedisClient(customRedis?: Redis): Redis | null {
    if (customRedis) return customRedis;
    try {
      return getRedis();
    } catch {
      return null;
    }
  }

  static async getUsage(
    tenantId: string,
    metric: 'messages' | 'ai' | 'kb',
    customRedis?: Redis,
  ): Promise<number> {
    const today = TenantQuotaTracker.getToday();
    const key =
      metric === 'kb'
        ? `quota:tenant:${tenantId}:kb`
        : `quota:tenant:${tenantId}:${metric}:${today}`;

    const redis = TenantQuotaTracker.getRedisClient(customRedis);
    if (redis) {
      try {
        const val = await redis.get(key);
        return val ? parseInt(val, 10) : 0;
      } catch {
        // Fall back to in-memory store
      }
    }

    return TenantQuotaTracker.inMemoryStore.get(key) ?? 0;
  }

  static async incrementUsage(
    tenantId: string,
    metric: 'messages' | 'ai' | 'kb',
    amount: number = 1,
    customRedis?: Redis,
  ): Promise<number> {
    const today = TenantQuotaTracker.getToday();
    const key =
      metric === 'kb'
        ? `quota:tenant:${tenantId}:kb`
        : `quota:tenant:${tenantId}:${metric}:${today}`;

    const redis = TenantQuotaTracker.getRedisClient(customRedis);
    if (redis) {
      try {
        const newVal = await redis.incrby(key, amount);
        if (newVal === amount && metric !== 'kb') {
          await redis.expire(key, 86400 * 2); // 2 days TTL
        }
        return newVal;
      } catch {
        // Fall back to in-memory store
      }
    }

    const current = TenantQuotaTracker.inMemoryStore.get(key) ?? 0;
    const updated = current + amount;
    TenantQuotaTracker.inMemoryStore.set(key, updated);
    return updated;
  }

  static resetInMemory(): void {
    TenantQuotaTracker.inMemoryStore.clear();
    const redis = TenantQuotaTracker.getRedisClient();
    if (redis && typeof (redis as any).reset === 'function') {
      (redis as any).reset();
    }
  }
}

/**
 * Express middleware for tenant quota tracking (TEN-4).
 * Returns X-Quota-Remaining-* headers and returns 429 when tenant limit is exceeded.
 */
export function createQuotaMiddleware(customRedis?: Redis) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let tenantId =
      (req.user?.tenantId as string | undefined) ??
      (req.headers['x-tenant-id'] as string | undefined);

    if (!tenantId && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.slice(7);
        const decoded = jwt.decode(token) as { tenantId?: string } | null;
        if (decoded?.tenantId) {
          tenantId = decoded.tenantId;
        }
      } catch {
        // Continue if decode fails
      }
    }

    if (!tenantId) {
      next();
      return;
    }

    const plan = (req.headers['x-tenant-plan'] === 'PRO' ? 'PRO' : 'FREE') as 'FREE' | 'PRO';
    const limits = PLAN_QUOTAS[plan];

    try {
      const [messagesUsed, aiUsed, kbUsed] = await Promise.all([
        TenantQuotaTracker.getUsage(tenantId, 'messages', customRedis),
        TenantQuotaTracker.getUsage(tenantId, 'ai', customRedis),
        TenantQuotaTracker.getUsage(tenantId, 'kb', customRedis),
      ]);

      const remainingMessages = Math.max(0, limits.messages - messagesUsed);
      const remainingAi = Math.max(0, limits.ai - aiUsed);
      const remainingKb = Math.max(0, limits.kb - kbUsed);

      res.setHeader('X-Quota-Remaining-Messages', remainingMessages);
      res.setHeader('X-Quota-Remaining-Ai', remainingAi);
      res.setHeader('X-Quota-Remaining-Kb', remainingKb);

      // Check quota based on route type
      const isPost = req.method === 'POST';
      const path = req.path;

      if (isPost && (path.includes('/messages') || path.includes('/tickets'))) {
        if (remainingMessages <= 0) {
          throw new AppError(
            429,
            `Daily message quota exceeded for tenant (${limits.messages} messages/day limit).`,
            '/errors/quota-exceeded',
          );
        }
        // Increment after successful response
        res.on('finish', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            void TenantQuotaTracker.incrementUsage(tenantId, 'messages', 1, customRedis);
          }
        });
      } else if (path.includes('/ai')) {
        if (remainingAi <= 0) {
          throw new AppError(
            429,
            `Daily AI call quota exceeded for tenant (${limits.ai} calls/day limit).`,
            '/errors/quota-exceeded',
          );
        }
        res.on('finish', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            void TenantQuotaTracker.incrementUsage(tenantId, 'ai', 1, customRedis);
          }
        });
      } else if (isPost && (path.includes('/kb') || path.includes('/uploads'))) {
        if (remainingKb <= 0) {
          throw new AppError(
            429,
            `KB storage quota exceeded for tenant (${Math.round(limits.kb / (1024 * 1024))}MB limit).`,
            '/errors/quota-exceeded',
          );
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
