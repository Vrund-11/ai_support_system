import type { Request, Response, NextFunction } from 'express';

export interface MetricLabels {
  [key: string]: string | number;
}

export interface MetricValue {
  labels: MetricLabels;
  value: number;
}

export class MetricsRegistry {
  private counters = new Map<
    string,
    { help: string; values: Map<string, { labels: MetricLabels; value: number }> }
  >();
  private gauges = new Map<
    string,
    { help: string; values: Map<string, { labels: MetricLabels; value: number }> }
  >();
  private histograms = new Map<
    string,
    {
      help: string;
      buckets: number[];
      values: Map<string, { labels: MetricLabels; counts: number[]; sum: number; count: number }>;
    }
  >();

  private serializeLabels(labels: MetricLabels): string {
    const keys = Object.keys(labels).sort();
    return keys.map((k) => `${k}="${labels[k]}"`).join(',');
  }

  registerCounter(name: string, help: string): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, { help, values: new Map() });
    }
  }

  registerGauge(name: string, help: string): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { help, values: new Map() });
    }
  }

  registerHistogram(
    name: string,
    help: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  ): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        help,
        buckets: [...buckets].sort((a, b) => a - b),
        values: new Map(),
      });
    }
  }

  incrementCounter(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const counter = this.counters.get(name);
    if (!counter) return;
    const key = this.serializeLabels(labels);
    const existing = counter.values.get(key);
    if (existing) {
      existing.value += value;
    } else {
      counter.values.set(key, { labels, value });
    }
  }

  setGauge(name: string, labels: MetricLabels = {}, value: number): void {
    const gauge = this.gauges.get(name);
    if (!gauge) return;
    const key = this.serializeLabels(labels);
    gauge.values.set(key, { labels, value });
  }

  observeHistogram(name: string, labels: MetricLabels = {}, value: number): void {
    const histogram = this.histograms.get(name);
    if (!histogram) return;
    const key = this.serializeLabels(labels);
    let entry = histogram.values.get(key);
    if (!entry) {
      entry = {
        labels,
        counts: new Array(histogram.buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      histogram.values.set(key, entry);
    }

    entry.count += 1;
    entry.sum += value;
    for (let i = 0; i < histogram.buckets.length; i++) {
      if (value <= histogram.buckets[i]!) {
        entry.counts[i]! += 1;
      }
    }
  }

  reset(): void {
    this.counters.forEach((c) => c.values.clear());
    this.gauges.forEach((g) => g.values.clear());
    this.histograms.forEach((h) => h.values.clear());
  }

  formatPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, counter] of this.counters.entries()) {
      lines.push(`# HELP ${name} ${counter.help}`);
      lines.push(`# TYPE ${name} counter`);
      for (const entry of counter.values.values()) {
        const labelStr = this.serializeLabels(entry.labels);
        lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${entry.value}`);
      }
    }

    // Gauges
    for (const [name, gauge] of this.gauges.entries()) {
      lines.push(`# HELP ${name} ${gauge.help}`);
      lines.push(`# TYPE ${name} gauge`);
      for (const entry of gauge.values.values()) {
        const labelStr = this.serializeLabels(entry.labels);
        lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${entry.value}`);
      }
    }

    // Histograms
    for (const [name, histogram] of this.histograms.entries()) {
      lines.push(`# HELP ${name} ${histogram.help}`);
      lines.push(`# TYPE ${name} histogram`);
      for (const entry of histogram.values.values()) {
        const baseLabels = this.serializeLabels(entry.labels);
        for (let i = 0; i < histogram.buckets.length; i++) {
          const bucketCount = entry.counts[i]!;
          const le = histogram.buckets[i]!;
          const bucketLabels = baseLabels ? `${baseLabels},le="${le}"` : `le="${le}"`;
          lines.push(`${name}_bucket{${bucketLabels}} ${bucketCount}`);
        }
        const infLabels = baseLabels ? `${baseLabels},le="+Inf"` : 'le="+Inf"';
        lines.push(`${name}_bucket{${infLabels}} ${entry.count}`);
        lines.push(`${name}_sum${baseLabels ? `{${baseLabels}}` : ''} ${entry.sum.toFixed(4)}`);
        lines.push(`${name}_count${baseLabels ? `{${baseLabels}}` : ''} ${entry.count}`);
      }
    }

    return lines.join('\n') + '\n';
  }
}

// Global default registry initialized with standard SupportPilot metrics
export const defaultRegistry = new MetricsRegistry();

defaultRegistry.registerCounter('http_requests_total', 'Total number of HTTP requests');
defaultRegistry.registerHistogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
);
defaultRegistry.registerGauge(
  'websocket_connections_active',
  'Current active WebSocket / Socket.IO connections',
);
defaultRegistry.registerCounter('queue_jobs_total', 'Total queue jobs processed by worker');
defaultRegistry.registerCounter('sla_breaches_total', 'Total SLA milestones breached');
defaultRegistry.registerCounter('llm_requests_total', 'Total LLM inference calls');
defaultRegistry.registerCounter('llm_tokens_total', 'Total LLM prompt and completion tokens');

export function createMetricsMiddleware(
  serviceName: string,
  registry: MetricsRegistry = defaultRegistry,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/metrics' || req.path === '/health' || req.path === '/ready') {
      next();
      return;
    }

    const start = performance.now();

    res.on('finish', () => {
      const durationSeconds = (performance.now() - start) / 1000;
      const route = req.route?.path || req.baseUrl || req.path || 'unknown';
      const tenantId = (req.headers['x-tenant-id'] as string) || 'anonymous';
      const status = res.statusCode.toString();

      registry.incrementCounter('http_requests_total', {
        service: serviceName,
        method: req.method,
        route,
        status,
        tenant_id: tenantId,
      });

      registry.observeHistogram(
        'http_request_duration_seconds',
        {
          service: serviceName,
          method: req.method,
          route,
        },
        durationSeconds,
      );
    });

    next();
  };
}

export function createMetricsHandler(registry: MetricsRegistry = defaultRegistry) {
  return (_req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(registry.formatPrometheus());
  };
}
