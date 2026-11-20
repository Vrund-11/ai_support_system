import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import {
  MetricsRegistry,
  createMetricsMiddleware,
  createMetricsHandler,
  Span,
  createTraceMiddleware,
  parseTraceparent,
  formatTraceparent,
  generateTraceId,
  generateSpanId,
} from '../src/index.js';

describe('Observability - Metrics Registry & Prometheus Formatter', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  it('registers and increments counters with labels', () => {
    registry.registerCounter('http_requests_total', 'Total HTTP requests');
    registry.incrementCounter('http_requests_total', { method: 'GET', status: '200' }, 1);
    registry.incrementCounter('http_requests_total', { method: 'GET', status: '200' }, 2);
    registry.incrementCounter('http_requests_total', { method: 'POST', status: '201' }, 1);

    const output = registry.formatPrometheus();
    expect(output).toContain('# HELP http_requests_total Total HTTP requests');
    expect(output).toContain('# TYPE http_requests_total counter');
    expect(output).toContain('http_requests_total{method="GET",status="200"} 3');
    expect(output).toContain('http_requests_total{method="POST",status="201"} 1');
  });

  it('registers and sets gauges', () => {
    registry.registerGauge('active_connections', 'Active sockets');
    registry.setGauge('active_connections', { room: 'support' }, 42);

    const output = registry.formatPrometheus();
    expect(output).toContain('# HELP active_connections Active sockets');
    expect(output).toContain('# TYPE active_connections gauge');
    expect(output).toContain('active_connections{room="support"} 42');
  });

  it('records histogram observations and calculates cumulative buckets, count, and sum', () => {
    registry.registerHistogram(
      'request_latency_seconds',
      'Request latency in seconds',
      [0.05, 0.1, 0.5, 1.0],
    );
    registry.observeHistogram('request_latency_seconds', { route: '/tickets' }, 0.04);
    registry.observeHistogram('request_latency_seconds', { route: '/tickets' }, 0.08);
    registry.observeHistogram('request_latency_seconds', { route: '/tickets' }, 0.6);

    const output = registry.formatPrometheus();
    expect(output).toContain('request_latency_seconds_bucket{route="/tickets",le="0.05"} 1');
    expect(output).toContain('request_latency_seconds_bucket{route="/tickets",le="0.1"} 2');
    expect(output).toContain('request_latency_seconds_bucket{route="/tickets",le="1"} 3');
    expect(output).toContain('request_latency_seconds_bucket{route="/tickets",le="+Inf"} 3');
    expect(output).toContain('request_latency_seconds_count{route="/tickets"} 3');
    expect(output).toContain('request_latency_seconds_sum{route="/tickets"} 0.7200');
  });

  it('resets all metric values on reset()', () => {
    registry.registerCounter('test_counter', 'Counter');
    registry.incrementCounter('test_counter', {}, 5);
    registry.reset();

    const output = registry.formatPrometheus();
    expect(output).not.toContain('test_counter 5');
  });
});

describe('Observability - OpenTelemetry W3C Tracing & Span Lifecycle', () => {
  it('generates valid 32-hex traceId and 16-hex spanId', () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();

    expect(traceId).toHaveLength(32);
    expect(spanId).toHaveLength(16);
    expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);
    expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
  });

  it('parses and formats W3C traceparent headers correctly', () => {
    const raw = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const parsed = parseTraceparent(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe('00');
    expect(parsed?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(parsed?.parentSpanId).toBe('00f067aa0ba902b7');
    expect(parsed?.traceFlags).toBe('01');

    const formatted = formatTraceparent(
      '4bf92f3577b34da6a3ce929d0e0e4736',
      '00f067aa0ba902b7',
      true,
    );
    expect(formatted).toBe(raw);
  });

  it('returns null for malformed traceparents', () => {
    expect(parseTraceparent('')).toBeNull();
    expect(parseTraceparent('invalid-trace-header')).toBeNull();
    expect(parseTraceparent('00-short-short-01')).toBeNull();
  });

  it('creates spans, captures attributes, and calculates duration on end()', async () => {
    const span = new Span('db:findTickets', null, { 'db.collection': 'tickets' });
    expect(span.traceId).toHaveLength(32);
    expect(span.spanId).toHaveLength(16);

    span.setAttribute('tenant.id', 'tenant_123');
    await new Promise((r) => setTimeout(r, 10));
    span.end();

    expect(span.endTime).toBeDefined();
    expect(span.durationMs).toBeGreaterThan(0);
    expect(span.attributes['db.collection']).toBe('tickets');
    expect(span.attributes['tenant.id']).toBe('tenant_123');
    expect(span.toTraceparent()).toContain(span.traceId);
  });
});

describe('Observability - Express Middleware Integration', () => {
  it('instruments HTTP requests with traceparent headers and prometheus metrics', async () => {
    const testRegistry = new MetricsRegistry();
    testRegistry.registerCounter('http_requests_total', 'Total HTTP requests');
    testRegistry.registerHistogram('http_request_duration_seconds', 'HTTP duration');

    const app = express();
    app.use(createTraceMiddleware('test-service'));
    app.use(createMetricsMiddleware('test-service', testRegistry));
    app.get('/metrics', createMetricsHandler(testRegistry));
    app.get('/api/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      // 1. Send request with incoming traceparent
      const incomingTrace = '00-abcdef1234567890abcdef1234567890-1234567890abcdef-01';
      const res = await fetch(`http://localhost:${port}/api/test`, {
        headers: {
          traceparent: incomingTrace,
          'x-tenant-id': 'tenant_obs_test',
        },
      });

      expect(res.status).toBe(200);
      const outTrace = res.headers.get('traceparent');
      expect(outTrace).toBeDefined();
      expect(outTrace).toContain('abcdef1234567890abcdef1234567890'); // traceId preserved!

      // 2. Fetch Prometheus metrics
      const metricsRes = await fetch(`http://localhost:${port}/metrics`);
      expect(metricsRes.status).toBe(200);
      expect(metricsRes.headers.get('content-type')).toContain('text/plain');

      const body = await metricsRes.text();
      expect(body).toContain(
        'http_requests_total{method="GET",route="/api/test",service="test-service",status="200",tenant_id="tenant_obs_test"} 1',
      );
      expect(body).toContain('http_request_duration_seconds_bucket');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
