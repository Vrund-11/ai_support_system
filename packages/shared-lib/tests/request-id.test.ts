import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { requestIdMiddleware, REQUEST_ID_HEADER } from '../src/middleware/request-id.js';

function createMockReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers: { ...headers },
  } as unknown as express.Request;

  const resHeaders: Record<string, string> = {};
  const res = {
    setHeader: vi.fn((key: string, val: string) => {
      resHeaders[key] = val;
    }),
    getHeader: (key: string) => resHeaders[key],
  } as unknown as express.Response;

  return { req, res };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID when no x-request-id header', () => {
    const { req, res } = createMockReqRes();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    const rid = (req as express.Request & { requestId: string }).requestId;
    expect(rid).toBeDefined();
    // UUID v4 format
    expect(rid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, rid);
    expect(next).toHaveBeenCalled();
  });

  it('reuses existing x-request-id from upstream', () => {
    const existingId = 'upstream-request-123';
    const { req, res } = createMockReqRes({ [REQUEST_ID_HEADER]: existingId });
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    const rid = (req as express.Request & { requestId: string }).requestId;
    expect(rid).toBe(existingId);
    expect(next).toHaveBeenCalled();
  });
});
