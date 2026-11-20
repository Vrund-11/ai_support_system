import type { Request, Response, NextFunction } from 'express';

export function createSecurityHeadersMiddleware(allowedOrigins: string[] = ['*']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // ── Security Headers (SEC-1 / Helmet Equivalent) ──
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:;",
    );

    // ── CORS Headers ──
    const origin = req.headers['origin'] as string | undefined;
    if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-tenant-id, x-user-id, x-user-role, traceparent, x-request-id',
    );
    res.setHeader('Access-Control-Expose-Headers', 'traceparent, x-request-id');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
