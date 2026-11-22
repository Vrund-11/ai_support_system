import type { Request, Response, NextFunction } from 'express';

export function serverTimingMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const startTime = performance.now();
  const timings: Record<string, number> = {
    db: 0,
    cache: 0,
  };

  res.locals['recordTiming'] = (name: string, durationMs: number) => {
    timings[name] = (timings[name] ?? 0) + durationMs;
  };

  const originalWriteHead = res.writeHead;
  res.writeHead = function (this: Response, statusCode: number, ...args: any[]) {
    const totalTime = performance.now() - startTime;
    timings['total'] = totalTime;

    const parts: string[] = [];
    for (const [name, dur] of Object.entries(timings)) {
      if (dur > 0 || name === 'total') {
        parts.push(`${name};dur=${dur.toFixed(1)}`);
      }
    }

    const currentTiming = res.getHeader('Server-Timing');
    const headerValue = currentTiming ? `${currentTiming}, ${parts.join(', ')}` : parts.join(', ');

    res.setHeader('Server-Timing', headerValue);
    return originalWriteHead.apply(this, [statusCode, ...args] as any);
  };

  next();
}
