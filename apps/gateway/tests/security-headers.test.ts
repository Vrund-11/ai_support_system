import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http, { type Server as HttpServer } from 'node:http';
import { createApp } from '../src/app.js';

describe('Gateway Security Headers & Rate Limiting (AUTH-5, SEC-1)', () => {
  let server: HttpServer;
  let port: number;
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

  beforeAll(async () => {
    store = new Map();
    const app = createApp({
      ticketServiceUrl: 'http://localhost:9999',
      aiServiceUrl: 'http://localhost:9998',
      jwtAccessSecret: 'sec-headers-test-secret-32-chars!',
      serviceToken: 'sec-headers-token',
      redisClient: mockRedis as any,
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as any).port;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('sets standard defensive security headers (CSP, HSTS, X-Frame-Options, nosniff)', async () => {
    const res = await fetch(`http://localhost:${port}/health`);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('handles CORS preflight OPTIONS requests gracefully with 204 No Content', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/tickets`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://support.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeDefined();
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  it('enforces login rate limit: 6th request within window returns 429 Too Many Requests', async () => {
    const loginPayload = JSON.stringify({
      email: 'attacker@example.com',
      password: 'wrong-password',
    });

    for (let i = 0; i < 5; i++) {
      await fetch(`http://localhost:${port}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: loginPayload,
      });
    }

    const rateLimitedRes = await fetch(`http://localhost:${port}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginPayload,
    });

    expect(rateLimitedRes.status).toBe(429);
    const data = await rateLimitedRes.json();
    expect(data.title.toLowerCase()).toContain('too many requests');
    expect(rateLimitedRes.headers.get('retry-after')).toBeDefined();
  });
});
