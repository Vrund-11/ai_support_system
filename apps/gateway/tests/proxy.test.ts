import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import http from 'node:http';
import { errorHandler, createLogger } from '@supportpilot/shared-lib';
import { createProxyMiddleware } from '../src/middleware/proxy.js';

describe('Gateway Reverse Proxy Middleware', () => {
  let mockServer: http.Server;
  let mockPort: number;
  let lastReceivedHeaders: http.IncomingHttpHeaders = {};
  let lastReceivedBody: any = null;

  beforeEach(async () => {
    // Start mock downstream microservice
    mockServer = http.createServer((req, res) => {
      lastReceivedHeaders = req.headers;
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          lastReceivedBody = body ? JSON.parse(body) : null;
        } catch {
          lastReceivedBody = body;
        }

        if (req.url === '/api/v1/tickets') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: [{ id: 't1', subject: 'Downstream Ticket' }] }));
          return;
        }

        if (req.url === '/api/v1/error') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ type: '/errors/validation', status: 400 }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'ok' }));
      });
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, () => {
        const addr = mockServer.address() as any;
        mockPort = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      mockServer.close(() => resolve());
    });
  });

  function buildGatewayApp(targetPort: number): Express {
    const app: Express = express();
    app.use(express.json());

    const proxy = createProxyMiddleware({
      targetBaseUrl: `http://localhost:${targetPort}`,
      serviceToken: 'super-secret-cluster-token',
    });

    app.use('/api/v1', proxy);
    app.use(errorHandler(createLogger('gateway-proxy-test', 'silent')));
    return app;
  }

  it('proxies request to downstream service and forwards serviceToken and requestId', async () => {
    const gatewayApp = buildGatewayApp(mockPort);

    const res = await request(gatewayApp)
      .get('/api/v1/tickets')
      .set('Authorization', 'Bearer token123')
      .set('x-request-id', 'req-999');

    expect(res.status).toBe(200);
    expect(res.body.data[0].subject).toBe('Downstream Ticket');

    // Verify forwarded headers
    expect(lastReceivedHeaders['authorization']).toBe('Bearer token123');
    expect(lastReceivedHeaders['x-request-id']).toBe('req-999');
    expect(lastReceivedHeaders['x-service-token']).toBe('super-secret-cluster-token');
  });

  it('proxies request body to downstream service', async () => {
    const gatewayApp = buildGatewayApp(mockPort);

    const payload = { subject: 'New ticket from gateway', priority: 'HIGH' };
    const res = await request(gatewayApp).post('/api/v1/tickets').send(payload);

    expect(res.status).toBe(200);
    expect(lastReceivedBody).toEqual(payload);
  });

  it('preserves downstream error responses', async () => {
    const gatewayApp = buildGatewayApp(mockPort);

    const res = await request(gatewayApp).get('/api/v1/error');
    expect(res.status).toBe(400);
    expect(res.body.type).toBe('/errors/validation');
  });

  it('returns 502 Bad Gateway when downstream service is unreachable', async () => {
    // Port 1 is reserved and unused, connection fails
    const gatewayApp = buildGatewayApp(1);

    const res = await request(gatewayApp).get('/api/v1/tickets');
    expect(res.status).toBe(502);
    expect(res.body.type).toBe('/errors/downstream-unavailable');
  });
});
