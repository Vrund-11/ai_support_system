import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { inviteTeamMemberSchema } from '@supportpilot/validators';
import { AppError } from '@supportpilot/shared-lib';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import { User } from '../models/user.model.js';
import { UserRepository } from '../repositories/user.repository.js';

export const teamRouter: Router = Router();

teamRouter.use(requireAuth);

// GET /api/v1/team — list tenant team members
teamRouter.get(
  '/',
  requireMinRole('AGENT'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const userRepo = new UserRepository(tenantId);
      const users = await userRepo.find({});

      res.status(200).json({
        data: users.map((u) => ({
          id: u._id.toString(),
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          isEmailVerified: u.isEmailVerified,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/team/invite — invite new team member (LEAD+ required)
teamRouter.post(
  '/invite',
  requireMinRole('LEAD'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = inviteTeamMemberSchema.safeParse(req.body);
      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
        throw new AppError(400, message, '/errors/validation');
      }

      const tenantId = req.user!.tenantId;
      const { email, name, role } = parseResult.data;
      const normalizedEmail = email.toLowerCase().trim();

      const userRepo = new UserRepository(tenantId);
      const existing = await userRepo.findByEmail(normalizedEmail);
      if (existing) {
        throw new AppError(409, 'User with this email already exists in team', '/errors/conflict');
      }

      // Generate random placeholder hash for invited user until acceptance/reset
      const placeholderPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(placeholderPassword, 10);
      const inviteToken = crypto.randomBytes(32).toString('hex');

      const newUser = await User.create({
        tenantId,
        email: normalizedEmail,
        name,
        role: role ?? 'AGENT',
        status: 'INVITED',
        passwordHash,
        emailVerificationToken: inviteToken,
        emailVerificationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isEmailVerified: false,
        notificationPrefs: { email: true, push: true, inApp: true },
      });

      res.status(201).json({
        data: {
          id: newUser._id.toString(),
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          status: newUser.status,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
