import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from '../src/middleware/error-handler.js';
import { createLogger } from '../src/logger.js';

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('errorHandler', () => {
  const logger = createLogger('test', 'silent');
  const handler = errorHandler(logger);

  it('returns RFC 7807 for AppError', () => {
    const err = new AppError(404, 'Ticket not found', '/errors/not-found');
    const req = { originalUrl: '/api/v1/tickets/123', path: '/api/v1/tickets/123' } as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    handler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '/errors/not-found',
        title: 'Ticket not found',
        status: 404,
        instance: '/api/v1/tickets/123',
      }),
    );
  });

  it('returns 500 for unexpected errors', () => {
    const err = new Error('kaboom');
    const req = { originalUrl: '/test', path: '/test' } as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    handler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Internal Server Error',
        status: 500,
      }),
    );
  });

  it('includes requestId when available', () => {
    const err = new AppError(400, 'Bad input');
    const req = {
      originalUrl: '/test',
      path: '/test',
      requestId: 'req-abc',
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    handler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-abc' }));
  });
});
