import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import * as dbModule from '../src/lib/mongoose.js';
import * as redisModule from '../src/lib/redis.js';
import { createApp } from '../src/app.js';

describe('ticket-service health endpoints', () => {
  const serviceToken = 'test-token-at-least-32-chars-long!';
  process.env['SERVICE_TOKEN'] = serviceToken;
  const app = createApp('silent');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('returns minimal 200 { status: "ok" } without metadata', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res.body.service).toBeUndefined();
      expect(res.body.timestamp).toBeUndefined();
    });
  });

  describe('GET /ready and /health/readiness', () => {
    it('unauthenticated GET /ready returns 200 { status: "ready" } with zero dependency names', async () => {
      vi.spyOn(dbModule, 'isDbConnected').mockReturnValue(true);
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(true);

      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ready' });
      expect(res.body.db).toBeUndefined();
      expect(res.body.mongodb).toBeUndefined();
      expect(res.body.redis).toBeUndefined();
      expect(res.body.dependencies).toBeUndefined();
    });

    it('unauthenticated GET /ready returns 503 { status: "not_ready" } with zero dependency names when DB disconnected', async () => {
      vi.spyOn(dbModule, 'isDbConnected').mockReturnValue(false);
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(true);

      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'not_ready' });
      expect(res.body.db).toBeUndefined();
      expect(res.body.mongodb).toBeUndefined();
      expect(res.body.redis).toBeUndefined();
      expect(res.body.dependencies).toBeUndefined();
    });

    it('unauthenticated GET /ready returns 503 { status: "not_ready" } when Redis disconnected', async () => {
      vi.spyOn(dbModule, 'isDbConnected').mockReturnValue(true);
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(false);

      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'not_ready' });
      expect(res.body.dependencies).toBeUndefined();
    });

    it('authenticated GET /ready returns dependency status when x-service-token is valid', async () => {
      vi.spyOn(dbModule, 'isDbConnected').mockReturnValue(true);
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(true);

      const res = await request(app).get('/ready').set('x-service-token', serviceToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ready',
        dependencies: {
          mongodb: 'connected',
          redis: 'connected',
        },
      });
    });

    it('unauthenticated GET /health/readiness alias works identically', async () => {
      vi.spyOn(dbModule, 'isDbConnected').mockReturnValue(true);
      vi.spyOn(redisModule, 'isRedisConnected').mockReturnValue(true);

      const res = await request(app).get('/health/readiness');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ready' });
    });
  });
});
