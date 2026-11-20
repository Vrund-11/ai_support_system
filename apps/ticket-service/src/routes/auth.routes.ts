import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  registerTenantSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from '@supportpilot/validators';
import { AppError } from '@supportpilot/shared-lib';
import { registerTenant } from '../services/tenant.service.js';
import { login, refreshTokens, logout } from '../services/auth.service.js';

export const authRouter: Router = Router();

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = registerTenantSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const result = await registerTenant(parseResult.data);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const result = await login(parseResult.data.email, parseResult.data.password);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = refreshSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tokens = await refreshTokens(parseResult.data.refreshToken);
    res.status(200).json({ data: tokens });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = logoutSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    await logout(parseResult.data.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
