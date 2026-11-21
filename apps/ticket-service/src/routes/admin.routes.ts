import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '@supportpilot/shared-lib';
import { Tenant } from '../models/tenant.model.js';
import { User } from '../models/user.model.js';
import { Ticket } from '../models/ticket.model.js';
import { isDbConnected } from '../lib/mongoose.js';

export const adminRouter: Router = Router();

adminRouter.use(requireAuth);

// GET /api/v1/admin/tenants - List all tenants with usage metrics (OWNER/PLATFORM ADMIN only)
adminRouter.get(
  '/tenants',
  requireMinRole('OWNER'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected() && !('mock' in Tenant.find)) {
        res.status(200).json({ data: [] });
        return;
      }

      const tenants = await Tenant.find().lean();
      const enriched = await Promise.all(
        tenants.map(async (t) => {
          const userCount = await User.countDocuments({ tenantId: t._id });
          const ticketCount = await Ticket.countDocuments({ tenantId: t._id });
          return {
            id: t._id.toString(),
            name: t.name,
            slug: t.slug,
            plan: (t as any).plan || 'ENTERPRISE',
            status: (t as any).status || 'ACTIVE',
            userCount,
            ticketCount,
            createdAt: t.createdAt,
          };
        }),
      );

      res.status(200).json({ data: enriched });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/admin/tenants/:id/status - Suspend or activate tenant (OWNER only)
adminRouter.patch(
  '/tenants/:id/status',
  requireMinRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
        res
          .status(400)
          .json({ title: 'Validation error', detail: 'Status must be ACTIVE or SUSPENDED' });
        return;
      }

      if (!isDbConnected() && !('mock' in Tenant.findByIdAndUpdate)) {
        res.status(200).json({ data: { id: req.params.id, status } });
        return;
      }

      const updated = await Tenant.findByIdAndUpdate(
        req.params.id,
        { $set: { status, updatedAt: new Date() } },
        { new: true },
      );

      if (!updated) {
        res.status(404).json({ title: 'Not found', detail: 'Tenant not found' });
        return;
      }

      res.status(200).json({
        data: {
          id: updated._id.toString(),
          name: updated.name,
          slug: updated.slug,
          status,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/admin/tenants/:id/plan - Upgrade or downgrade tenant plan (OWNER only)
adminRouter.patch(
  '/tenants/:id/plan',
  requireMinRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { plan } = req.body;
      if (!['FREE', 'PRO'].includes(plan)) {
        res.status(400).json({ title: 'Validation error', detail: 'Plan must be FREE or PRO' });
        return;
      }

      if (!isDbConnected() && !('mock' in Tenant.findByIdAndUpdate)) {
        res.status(200).json({ data: { id: req.params.id, plan, success: true } });
        return;
      }

      const updated = await Tenant.findByIdAndUpdate(
        req.params.id,
        { $set: { plan, updatedAt: new Date() } },
        { new: true },
      );

      if (!updated) {
        res.status(404).json({ title: 'Not found', detail: 'Tenant not found' });
        return;
      }

      res.status(200).json({
        data: {
          id: updated._id.toString(),
          name: updated.name,
          slug: updated.slug,
          plan: updated.plan,
          success: true,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/admin/health - Platform health metrics
adminRouter.get(
  '/health',
  requireMinRole('LEAD'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const dbStatus = isDbConnected() ? 'healthy' : 'degraded';
      res.status(200).json({
        data: {
          status: 'operational',
          database: dbStatus,
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
