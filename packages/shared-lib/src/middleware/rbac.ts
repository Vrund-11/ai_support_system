import type { Role, AuthUser } from '@supportpilot/shared-types';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';

export const ROLE_HIERARCHY: Record<Role, number> = {
  PLATFORM_ADMIN: 100,
  OWNER: 40,
  LEAD: 30,
  AGENT: 20,
  VIEWER: 10,
};

/**
 * Check if user's role satisfies a minimum hierarchy level.
 * PLATFORM_ADMIN always satisfies.
 */
export function hasMinRole(userRole: Role, minRole: Role): boolean {
  if (userRole === 'PLATFORM_ADMIN') return true;
  const userRank = ROLE_HIERARCHY[userRole] ?? 0;
  const targetRank = ROLE_HIERARCHY[minRole] ?? Infinity;
  return userRank >= targetRank;
}

/**
 * Check if user has one of explicitly allowed roles.
 * PLATFORM_ADMIN always satisfies.
 */
export function hasRole(userRole: Role, allowedRoles: Role[]): boolean {
  if (userRole === 'PLATFORM_ADMIN') return true;
  return allowedRoles.includes(userRole);
}

/**
 * Deny-by-default RBAC middleware requiring specific roles.
 * - 401 if unauthenticated (no req.user)
 * - 403 if user has no assigned role
 * - 403 if allowedRoles is empty (deny-by-default)
 * - 403 if user role is not in allowedRoles (and not PLATFORM_ADMIN)
 */
export function requireRoles(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user) {
      throw new AppError(401, 'Authentication required', '/errors/unauthorized');
    }
    if (!user.role) {
      throw new AppError(
        403,
        'Forbidden: permission denied: user has no assigned role',
        '/errors/forbidden',
      );
    }
    if (allowedRoles.length === 0 || !hasRole(user.role, allowedRoles)) {
      throw new AppError(
        403,
        `Forbidden: permission denied: requires one of [${allowedRoles.join(', ')}]`,
        '/errors/forbidden',
      );
    }
    next();
  };
}

/**
 * Deny-by-default RBAC middleware requiring minimum role hierarchy level.
 * e.g. requireMinRole('AGENT') allows AGENT, LEAD, OWNER, PLATFORM_ADMIN.
 * - 401 if unauthenticated
 * - 403 if user has no assigned role
 * - 403 if user role rank < minRole rank
 */
export function requireMinRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user) {
      throw new AppError(401, 'Authentication required', '/errors/unauthorized');
    }
    if (!user.role) {
      throw new AppError(
        403,
        'Forbidden: permission denied: user has no assigned role',
        '/errors/forbidden',
      );
    }
    if (!hasMinRole(user.role, minRole)) {
      throw new AppError(
        403,
        `Forbidden: permission denied: requires minimum role of ${minRole}`,
        '/errors/forbidden',
      );
    }
    next();
  };
}
