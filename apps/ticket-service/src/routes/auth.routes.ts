import { Router, type Request, type Response, type NextFunction } from 'express';
import { registerTenantSchema } from '@supportpilot/validators';
import { AppError } from '@supportpilot/shared-lib';
import { registerTenant } from '../services/tenant.service.js';

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
