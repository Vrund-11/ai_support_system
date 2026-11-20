import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { errorHandler, createLogger } from '@supportpilot/shared-lib';
import { createRateLimiter } from '../src/middleware/rate-limiter.js';

describe('Gateway Rate Limiter (AUTH-5)', () => {
  let store: Map<string, { value: number; ttl: number }>;

  const mockRedis = {
    incr: vi.fn(async (key: string) => {
      const entry = store.get(key) ?? { value: 0, ttl: 900 };
      entry.value += 1;
      store.set(key, entry);
      return entry.value;
    }),
    expire: vi.fn(async (key: string, seconds: number) => {
      const entry = store.get(key);
      if (entry) entry.ttl = seconds;
      return 1;
    }),
    ttl: vi.fn(async (key: string) => {
      return store.get(key)?.ttl ?? 900;
    }),
  };

  function buildAppWithLimiter(max: number, windowMs: number): Express {
    const app: Express = express();
    app.use(express.json());

    const limiter = createRateLimiter(
      {
        max,
        windowMs,
        prefix: 'rl:test',
      },
      mockRedis as any,
    );

    app.post('/test-action', limiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    app.use(errorHandler(createLogger('limiter-test', 'silent')));
    return app;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    store = new Map();
  });

  it('allows requests within limit and sets X-RateLimit headers', async () => {
    const app = buildAppWithLimiter(5, 15 * 60 * 1000);

    const res = await request(app).post('/test-action').send({});

    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBe('4');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('rejects with 429 and Retry-After when rate limit is exceeded (AUTH-5)', async () => {
    const app = buildAppWithLimiter(2, 60 * 1000);

    // Request 1 — OK
    const res1 = await request(app).post('/test-action').send({});
    expect(res1.status).toBe(200);

    // Request 2 — OK (at limit)
    const res2 = await request(app).post('/test-action').send({});
    expect(res2.status).toBe(200);
    expect(res2.headers['x-ratelimit-remaining']).toBe('0');

    // Request 3 — Exceeded (429)
    const res3 = await request(app).post('/test-action').send({});
    expect(res3.status).toBe(429);
    expect(res3.headers['retry-after']).toBeDefined();
    expect(res3.body).toMatchObject({
      status: 429,
      type: '/errors/rate-limited',
    });
  });
});
