import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import * as dbModule from '../src/lib/mongoose.js';
import { createApp } from '../src/app.js';

describe('ticket-service health endpoints', () => {
  const app = createApp('silent');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('returns 200 ok with timestamp and service name', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        service: 'ticket-service',
      });
      expect(typeof res.body.timestamp).toBe('string');
    });
  });

  describe('GET /ready', () => {
    it('returns 200 ready when DB is connected', async () => {
      vi.spyOn(dbModule, 'isDbConnected').mockReturnValue(true);

      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ready',
        db: 'connected',
      });
    });

    it('returns 503 not ready when DB is disconnected', async () => {
      vi.spyOn(dbModule, 'isDbConnected').mockReturnValue(false);

      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        status: 'not ready',
        db: 'disconnected',
      });
    });
  });
});
