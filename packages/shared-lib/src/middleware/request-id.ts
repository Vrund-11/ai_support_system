import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/** Header name for request tracing across services */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Attaches a unique requestId to every request.
 * Reuses incoming x-request-id from upstream (gateway -> service calls).
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  const existing = req.headers[REQUEST_ID_HEADER];
  const requestId = typeof existing === 'string' && existing.length > 0 ? existing : uuidv4();

  // Make available on req for downstream use
  (req as Request & { requestId: string }).requestId = requestId;

  // Echo back in response
  _res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}
