import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Gateway Health Endpoints (GET /health, /ready)', () => {
  const app = createApp({ logLevel: 'silent' });

  it('GET /health returns 200 with service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'gateway',
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /ready returns 200 readiness probe', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});
