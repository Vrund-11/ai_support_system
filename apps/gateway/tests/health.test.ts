import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import * as redisModule from '../src/lib/redis.js';
import { createApp } from '../src/app.js';

describe('Gateway Health Endpoints (GET /health, /ready, /health/readiness)', () => {
  const serviceToken = 'test-secret-service-token-32-chars!';
  const app = createApp({ logLevel: 'silent', serviceToken });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('returns minimal 200 { status: "ok" } without leaking metadata', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res.body.service).toBeUndefined();
      expect(res.body.timestamp).toBeUndefined();
    });
  });

  describe('GET /ready and /health/readiness', () => {
    it('unauthenticated GET /ready returns 200 { status: "ready" } with zero dependency names', async () => {
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(true);

      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ready' });
      expect(res.body.dependencies).toBeUndefined();
      expect(res.body.redis).toBeUndefined();
    });

    it('unauthenticated GET /ready returns 503 { status: "not_ready" } with zero dependency names when redis down', async () => {
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(false);

      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'not_ready' });
      expect(res.body.dependencies).toBeUndefined();
      expect(res.body.redis).toBeUndefined();
    });

    it('authenticated GET /ready returns dependencies detail when x-service-token matches', async () => {
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(true);

      const res = await request(app).get('/ready').set('x-service-token', serviceToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ready',
        dependencies: {
          redis: 'connected',
        },
      });
    });

    it('unauthenticated GET /health/readiness alias works identically', async () => {
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(true);

      const res = await request(app).get('/health/readiness');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ready' });
    });
  });
});
