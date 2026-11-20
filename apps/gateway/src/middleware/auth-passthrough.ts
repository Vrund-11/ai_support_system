import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@supportpilot/shared-types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * In-memory JWT verification and auth passthrough middleware.
 * Verifies JWT in memory without DB query (PRD section 15).
 * Attaches decoded user to req.user and passes Authorization header downstream.
 */
export function createAuthPassthrough(jwtSecret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      try {
        const decoded = jwt.verify(token, jwtSecret) as AuthUser;
        req.user = decoded;
      } catch {
        // Invalid or expired token — let downstream service reject with proper 401
      }
    }
    next();
  };
}
