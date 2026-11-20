import { Router, type Request, type Response, type NextFunction } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import { AnalyticsService } from '../services/analytics.service.js';

export const analyticsRouter: Router = Router();

analyticsRouter.use(requireAuth, requireMinRole('AGENT'));

// GET /api/v1/analytics/overview?rangeDays=7
analyticsRouter.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = new Types.ObjectId(req.user!.tenantId);
    const rangeDays = Number(req.query['rangeDays'] || 7);
    const service = new AnalyticsService(tenantId);
    const overview = await service.getOverview(rangeDays);
    res.status(200).json({ data: overview });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/volume?rangeDays=7 (ANL-1)
analyticsRouter.get('/volume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = new Types.ObjectId(req.user!.tenantId);
    const rangeDays = Number(req.query['rangeDays'] || 7);
    const service = new AnalyticsService(tenantId);
    const volume = await service.getVolumeAnalytics(rangeDays);
    res.status(200).json({ data: volume });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/sla?rangeDays=30 (ANL-2)
analyticsRouter.get('/sla', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = new Types.ObjectId(req.user!.tenantId);
    const rangeDays = Number(req.query['rangeDays'] || 30);
    const service = new AnalyticsService(tenantId);
    const sla = await service.getSlaAnalytics(rangeDays);
    res.status(200).json({ data: sla });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/agents?rangeDays=30 (ANL-3)
analyticsRouter.get('/agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = new Types.ObjectId(req.user!.tenantId);
    const rangeDays = Number(req.query['rangeDays'] || 30);
    const service = new AnalyticsService(tenantId);
    const agents = await service.getAgentPerformance(rangeDays);
    res.status(200).json({ data: agents });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/deflection?rangeDays=30 (ANL-4)
analyticsRouter.get('/deflection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = new Types.ObjectId(req.user!.tenantId);
    const rangeDays = Number(req.query['rangeDays'] || 30);
    const service = new AnalyticsService(tenantId);
    const deflection = await service.getDeflectionAnalytics(rangeDays);
    res.status(200).json({ data: deflection });
  } catch (err) {
    next(err);
  }
});
