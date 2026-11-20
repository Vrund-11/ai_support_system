import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface TraceContext {
  version: string;
  traceId: string;
  parentSpanId?: string;
  traceFlags: string;
}

export function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function generateSpanId(): string {
  return crypto.randomBytes(8).toString('hex');
}

export function parseTraceparent(header?: string | null): TraceContext | null {
  if (!header) return null;
  const parts = header.trim().split('-');
  if (parts.length !== 4) return null;
  const [version, traceId, parentSpanId, traceFlags] = parts;
  if (!version || !traceId || !parentSpanId || !traceFlags) return null;
  if (traceId.length !== 32 || parentSpanId.length !== 16) return null;
  return { version, traceId, parentSpanId, traceFlags };
}

export function formatTraceparent(
  traceId: string,
  spanId: string,
  sampled: boolean = true,
): string {
  return `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`;
}

export class Span {
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly parentSpanId?: string;
  public readonly name: string;
  public readonly startTime: number;
  public endTime?: number;
  public durationMs?: number;
  public attributes: Record<string, string | number | boolean>;

  constructor(
    name: string,
    parentContext?: TraceContext | null,
    initialAttributes: Record<string, string | number | boolean> = {},
  ) {
    this.name = name;
    this.traceId = parentContext?.traceId || generateTraceId();
    this.parentSpanId = parentContext?.parentSpanId;
    this.spanId = generateSpanId();
    this.startTime = performance.now();
    this.attributes = { ...initialAttributes };
  }

  setAttribute(key: string, value: string | number | boolean): this {
    this.attributes[key] = value;
    return this;
  }

  end(): this {
    if (this.endTime === undefined) {
      this.endTime = performance.now();
      this.durationMs = Math.round((this.endTime - this.startTime) * 100) / 100;
    }
    return this;
  }

  toTraceparent(sampled: boolean = true): string {
    return formatTraceparent(this.traceId, this.spanId, sampled);
  }
}

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      span?: Span;
    }
  }
}

export function createTraceMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incomingTraceparent = req.headers['traceparent'] as string | undefined;
    const parentContext = parseTraceparent(incomingTraceparent);

    const span = new Span(`${serviceName}:${req.method} ${req.path}`, parentContext, {
      'service.name': serviceName,
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.path,
    });

    req.traceId = span.traceId;
    req.span = span;

    res.setHeader('traceparent', span.toTraceparent());

    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      if (req.headers['x-tenant-id']) {
        span.setAttribute('tenant.id', req.headers['x-tenant-id'] as string);
      }
      span.end();
    });

    next();
  };
}
