import { Router, type Request, type Response, type NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '@supportpilot/shared-lib';
import { updateNotificationPrefsSchema } from '@supportpilot/validators';
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
        notificationPrefs: user.notificationPrefs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/me/preferences — get notification preferences (NOTIF-4)
userRouter.get('/me/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.sub;
    const userRepo = new UserRepository(tenantId);
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', '/errors/not-found');
    }
    res.status(200).json({
      data: user.notificationPrefs ?? { email: true, push: true, inApp: true },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/me/preferences — update notification preferences (NOTIF-4)
userRouter.patch('/me/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = updateNotificationPrefsSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const userId = req.user!.sub;
    const userRepo = new UserRepository(tenantId);
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', '/errors/not-found');
    }

    if (!user.notificationPrefs) {
      user.notificationPrefs = { email: true, push: true, inApp: true };
    }

    if (parseResult.data.email !== undefined) {
      user.notificationPrefs.email = parseResult.data.email;
    }
    if (parseResult.data.push !== undefined) {
      user.notificationPrefs.push = parseResult.data.push;
    }
    if (parseResult.data.inApp !== undefined) {
      user.notificationPrefs.inApp = parseResult.data.inApp;
    }

    await user.save();

    res.status(200).json({
      data: user.notificationPrefs,
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
