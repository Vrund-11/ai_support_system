import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@supportpilot/shared-lib';

export interface ProxyOptions {
  targetBaseUrl: string;
  serviceToken: string;
  pathRewrite?: (path: string) => string;
}

/**
 * Reverse proxy middleware to forward requests to internal microservices.
 * Forwards method, path, query params, headers, and body.
 * Injects `x-service-token` for cluster security (PRD section 4).
 * Returns RFC 7807 problem details with 502 Bad Gateway if downstream is unavailable.
 */
export function createProxyMiddleware(options: ProxyOptions) {
  const target = options.targetBaseUrl.replace(/\/+$/, '');

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const reqPath = options.pathRewrite ? options.pathRewrite(req.originalUrl) : req.originalUrl;
    const url = `${target}${reqPath}`;

    const headers: Record<string, string> = {
      'x-service-token': options.serviceToken,
    };

    if (req.headers.authorization) {
      headers['authorization'] = req.headers.authorization;
    }

    if (req.headers['x-request-id']) {
      headers['x-request-id'] = req.headers['x-request-id'] as string;
    }

    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'] as string;
    }

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    try {
      const response = await fetch(url, init);

      // Copy response headers
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('content-type', contentType);
      }

      const bodyText = await response.text();
      res.status(response.status).send(bodyText);
    } catch {
      next(
        new AppError(
          502,
          'Bad Gateway: Downstream service is currently unreachable',
          '/errors/downstream-unavailable',
        ),
      );
    }
  };
}
