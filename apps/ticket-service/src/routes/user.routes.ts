import { Router, type Request, type Response, type NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '@supportpilot/shared-lib';
import { requireAuth } from '../middleware/auth.middleware.js';
import { UserRepository } from '../repositories/user.repository.js';

export const userRouter: Router = Router();

userRouter.use(requireAuth);

// GET /api/v1/users/me — current agent profile
userRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.sub;
    const userRepo = new UserRepository(tenantId);
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', '/errors/not-found');
    }
    res.status(200).json({
      data: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/batch?ids=... — batch lookup for DataLoader (INT-3)
userRouter.get('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idsParam = typeof req.query['ids'] === 'string' ? req.query['ids'] : '';
    const ids = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const validIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (validIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    const tenantId = req.user!.tenantId;
    const userRepo = new UserRepository(tenantId);
    const users = await userRepo.find({ _id: { $in: validIds } });

    res.status(200).json({
      data: users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name,
        role: u.role,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/:id — single user lookup
userRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    const tenantId = req.user!.tenantId;
    const userRepo = new UserRepository(tenantId);
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', '/errors/not-found');
    }
    res.status(200).json({
      data: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});
