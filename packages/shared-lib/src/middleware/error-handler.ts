import type { Request, Response, NextFunction } from 'express';
import type { ProblemDetails } from '@supportpilot/shared-types';
import type { Logger } from '../logger.js';

/**
 * Custom error class with status and RFC 7807 type.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly type: string = 'about:blank',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * RFC 7807 error handler middleware.
 * Must be registered LAST (after all routes).
 */
export function errorHandler(logger: Logger) {
  return (err: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestId = (req as Request & { requestId?: string }).requestId;

    if (err instanceof AppError) {
      logger.warn({ err, requestId, status: err.status, path: req.path }, err.message);

      const problem: ProblemDetails = {
        type: err.type,
        title: err.message,
        status: err.status,
        instance: req.originalUrl,
        ...(requestId ? { requestId } : {}),
        ...(err.details ?? {}),
      };

      res.status(err.status).json(problem);
      return;
    }

    // Unexpected error — log full stack, return 500
    logger.error({ err, requestId, path: req.path }, 'Unhandled error');

    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      instance: req.originalUrl,
      ...(requestId ? { requestId } : {}),
    };

    res.status(500).json(problem);
  };
}
