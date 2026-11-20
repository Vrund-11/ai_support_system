import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Role, AuthUser } from '@supportpilot/shared-types';
import {
  requireRoles,
  requireMinRole,
  hasMinRole,
  hasRole,
  ROLE_HIERARCHY,
} from '../src/middleware/rbac.js';
import { AppError } from '../src/middleware/error-handler.js';

function createMockReq(user?: Partial<AuthUser>): Request {
  return { user } as unknown as Request;
}

const mockRes = {} as Response;

describe('RBAC (Role-Based Access Control)', () => {
  describe('ROLE_HIERARCHY and helpers', () => {
    it('defines expected role ranks', () => {
      expect(ROLE_HIERARCHY.PLATFORM_ADMIN).toBeGreaterThan(ROLE_HIERARCHY.OWNER);
      expect(ROLE_HIERARCHY.OWNER).toBeGreaterThan(ROLE_HIERARCHY.LEAD);
      expect(ROLE_HIERARCHY.LEAD).toBeGreaterThan(ROLE_HIERARCHY.AGENT);
      expect(ROLE_HIERARCHY.AGENT).toBeGreaterThan(ROLE_HIERARCHY.VIEWER);
    });

    it('hasMinRole checks hierarchy properly', () => {
      expect(hasMinRole('OWNER', 'AGENT')).toBe(true);
      expect(hasMinRole('LEAD', 'AGENT')).toBe(true);
      expect(hasMinRole('AGENT', 'AGENT')).toBe(true);
      expect(hasMinRole('VIEWER', 'AGENT')).toBe(false);
      expect(hasMinRole('PLATFORM_ADMIN', 'OWNER')).toBe(true);
      expect(hasMinRole('VIEWER', 'OWNER')).toBe(false);
    });

    it('hasRole checks explicitly allowed roles', () => {
      expect(hasRole('OWNER', ['OWNER', 'LEAD'])).toBe(true);
      expect(hasRole('AGENT', ['OWNER', 'LEAD'])).toBe(false);
      expect(hasRole('PLATFORM_ADMIN', ['AGENT'])).toBe(true);
    });
  });

  describe('requireRoles middleware (deny-by-default)', () => {
    it('throws 401 when request is unauthenticated', () => {
      const middleware = requireRoles('AGENT');
      const req = createMockReq(undefined);
      const next = vi.fn() as NextFunction;

      expect(() => middleware(req, mockRes, next)).toThrow(AppError);
      try {
        middleware(req, mockRes, next);
      } catch (e: any) {
        expect(e.status).toBe(401);
        expect(e.type).toBe('/errors/unauthorized');
      }
    });

    it('throws 403 when user has no assigned role', () => {
      const middleware = requireRoles('AGENT');
      const req = createMockReq({ sub: '123' } as any);
      const next = vi.fn() as NextFunction;

      expect(() => middleware(req, mockRes, next)).toThrow(AppError);
      try {
        middleware(req, mockRes, next);
      } catch (e: any) {
        expect(e.status).toBe(403);
        expect(e.type).toBe('/errors/forbidden');
      }
    });

    it('throws 403 when allowedRoles is empty (deny-by-default)', () => {
      const middleware = requireRoles();
      const req = createMockReq({ role: 'OWNER' } as any);
      const next = vi.fn() as NextFunction;

      expect(() => middleware(req, mockRes, next)).toThrow(AppError);
    });

    it('throws 403 when user role is not allowed', () => {
      const middleware = requireRoles('OWNER', 'LEAD');
      const req = createMockReq({ role: 'AGENT' as Role });
      const next = vi.fn() as NextFunction;

      expect(() => middleware(req, mockRes, next)).toThrow(AppError);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when user role is allowed', () => {
      const middleware = requireRoles('OWNER', 'LEAD');
      const req = createMockReq({ role: 'OWNER' as Role });
      const next = vi.fn() as NextFunction;

      middleware(req, mockRes, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next() for PLATFORM_ADMIN on any role check', () => {
      const middleware = requireRoles('VIEWER');
      const req = createMockReq({ role: 'PLATFORM_ADMIN' as Role });
      const next = vi.fn() as NextFunction;

      middleware(req, mockRes, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireMinRole middleware', () => {
    it('throws 401 when request is unauthenticated', () => {
      const middleware = requireMinRole('AGENT');
      const req = createMockReq(undefined);
      const next = vi.fn() as NextFunction;

      expect(() => middleware(req, mockRes, next)).toThrow(AppError);
    });

    it('throws 403 when user role is below minimum', () => {
      const middleware = requireMinRole('LEAD');
      const req = createMockReq({ role: 'AGENT' as Role });
      const next = vi.fn() as NextFunction;

      expect(() => middleware(req, mockRes, next)).toThrow(AppError);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when user role is at minimum', () => {
      const middleware = requireMinRole('AGENT');
      const req = createMockReq({ role: 'AGENT' as Role });
      const next = vi.fn() as NextFunction;

      middleware(req, mockRes, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next() when user role is above minimum', () => {
      const middleware = requireMinRole('AGENT');
      const req = createMockReq({ role: 'OWNER' as Role });
      const next = vi.fn() as NextFunction;

      middleware(req, mockRes, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
