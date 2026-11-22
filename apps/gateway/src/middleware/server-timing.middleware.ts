import type { Request, Response, NextFunction } from 'express';

export function createGatewayTimingMiddleware() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const startTime = performance.now();

    const originalWriteHead = res.writeHead;
    res.writeHead = function (this: Response, statusCode: number, ...args: any[]) {
      const gwDur = (performance.now() - startTime).toFixed(1);
      const existing = res.getHeader('Server-Timing');
      const gwTiming = `gateway;dur=${gwDur}`;
      const headerValue = existing ? `${existing}, ${gwTiming}` : gwTiming;

      res.setHeader('Server-Timing', headerValue);
      return originalWriteHead.apply(this, [statusCode, ...args] as any);
    };

    next();
  };
}
