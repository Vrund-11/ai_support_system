import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@supportpilot/shared-lib';
import { verifyAccessToken, type TokenPayload } from '../services/auth.service.js';

/** Extend Express Request with authenticated user */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * JWT auth middleware. Extracts Bearer token, verifies, attaches user to req.
 * 401 if missing or invalid.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing or malformed Authorization header', '/errors/unauthorized');
  }

  const token = header.slice(7);
  req.user = verifyAccessToken(token);
  next();
}
