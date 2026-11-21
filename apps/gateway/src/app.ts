import express, { type Express } from 'express';
import type { Redis } from 'ioredis';
import {
  createLogger,
  requestIdMiddleware,
  errorHandler,
  createMetricsMiddleware,
  createMetricsHandler,
  createTraceMiddleware,
} from '@supportpilot/shared-lib';
import { isRedisConnected } from './lib/redis.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { createQuotaMiddleware } from './middleware/quota.middleware.js';
import { createAuthPassthrough } from './middleware/auth-passthrough.js';
import { createProxyMiddleware } from './middleware/proxy.js';
import { createSecurityHeadersMiddleware } from './middleware/security.js';
import { setupGraphQL } from './graphql/server.js';

export interface GatewayConfig {
  logLevel?: string;
  ticketServiceUrl?: string;
  aiServiceUrl?: string;
  serviceToken?: string;
  jwtAccessSecret?: string;
  redisClient?: Redis;
}

export function createApp(config: GatewayConfig = {}): Express {
  const logger = createLogger('gateway', config.logLevel ?? 'info');
  const app: Express = express();

  const ticketServiceUrl =
    config.ticketServiceUrl ?? process.env['TICKET_SERVICE_URL'] ?? 'http://localhost:4001';
  const aiServiceUrl =
    config.aiServiceUrl ?? process.env['AI_SERVICE_URL'] ?? 'http://localhost:8000';
  const serviceToken =
    config.serviceToken ?? process.env['SERVICE_TOKEN'] ?? 'default-service-token';
  const jwtAccessSecret =
    config.jwtAccessSecret ??
    process.env['JWT_ACCESS_SECRET'] ??
    'default-secret-at-least-32-chars!!';

  app.use(createSecurityHeadersMiddleware());
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(createTraceMiddleware('gateway'));
  app.use(createMetricsMiddleware('gateway'));

  // ── Metrics endpoint (Prometheus) ──
  app.get('/metrics', createMetricsHandler());

  // ── Liveness probe ──
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'gateway',
      timestamp: new Date().toISOString(),
    });
  });

  // ── Readiness probe ──
  app.get('/ready', (_req, res) => {
    const ready = isRedisConnected();
    if (ready) {
      res.status(200).json({ status: 'ready', redis: 'connected' });
      return;
    }
    res.status(200).json({ status: 'ready', redis: 'degraded' });
  });

  // ── In-memory JWT verification & auth passthrough ──
  app.use(createAuthPassthrough(jwtAccessSecret));

  // ── Rate Limiters (AUTH-5) ──
  // Login: 5 requests per 15 minutes per IP
  const loginLimiter = createRateLimiter(
    {
      windowMs: 15 * 60 * 1000,
      max: 5,
      prefix: 'rl:login',
    },
    config.redisClient,
  );

  // General API: 100 requests per minute
  const apiLimiter = createRateLimiter(
    {
      windowMs: 60 * 1000,
      max: 100,
      prefix: 'rl:api',
    },
    config.redisClient,
  );

  app.use('/api/v1/auth/login', loginLimiter);
  app.use('/api/v1', apiLimiter);

  // ── Tenant Quota Middleware (TEN-4) ──
  app.use('/api/v1', createQuotaMiddleware(config.redisClient));

  // ── GraphQL Layer (Apollo Server) (INT-3) ──
  setupGraphQL(app, {
    ticketServiceUrl,
    serviceToken,
  });

  // ── Proxy routes to ticket-service ──
  const ticketProxy = createProxyMiddleware({
    targetBaseUrl: ticketServiceUrl,
    serviceToken,
  });

  app.use('/api/v1/auth', ticketProxy);
  app.use('/api/v1/tickets', ticketProxy);
  app.use('/api/v1/customers', ticketProxy);
  app.use('/api/v1/team', ticketProxy);
  app.use('/api/v1/docs', ticketProxy);
  app.use('/api/v1/uploads', ticketProxy);
  app.use('/api/v1/kb', ticketProxy);
  app.use('/api/v1/users', ticketProxy);
  app.use('/api/v1/analytics', ticketProxy);
  app.use('/api/v1/rules', ticketProxy);
  app.use(
    '/api/v1/automation',
    createProxyMiddleware({
      targetBaseUrl: ticketServiceUrl,
      serviceToken,
      pathRewrite: (path) => path.replace(/^\/api\/v1\/automation/, '/api/v1/rules'),
    }),
  );
  app.use('/api/v1/notifications', ticketProxy);
  app.use('/api/v1/api-keys', ticketProxy);
  app.use('/api/v1/webhooks', ticketProxy);
  app.use('/api/v1/audit-logs', ticketProxy);
  app.use('/api/v1/feature-flags', ticketProxy);
  app.use('/api/v1/billing', ticketProxy);
  app.use('/api/v1/admin', ticketProxy);
  app.use('/api/v1/superadmin', ticketProxy);

  // ── Proxy routes to ai-service (AI-5, AI-6, AI-1) ──
  const aiProxy = createProxyMiddleware({
    targetBaseUrl: aiServiceUrl,
    serviceToken,
    pathRewrite: (path) => path.replace(/^\/api\/v1\/ai/, '/v1'),
  });

  app.use('/api/v1/ai', aiProxy);

  // ── Error handler (must be last) ──
  app.use(errorHandler(logger));

  return app;
}
