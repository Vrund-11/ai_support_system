import { Router, type Request, type Response } from 'express';
import type { QueueManager } from '../manager.js';

export function createDlqRoutes(queueManager: QueueManager, expectedServiceToken: string): Router {
  const router = Router();

  // Internal service token authentication middleware
  router.use((req: Request, res: Response, next) => {
    const token = req.headers['x-service-token'] as string;
    if (!token || token !== expectedServiceToken) {
      res.status(401).json({
        type: 'https://supportpilot.io/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Valid x-service-token header is required for DLQ access',
      });
      return;
    }
    next();
  });

  // GET /dlq?tenantId=...
  router.get('/', (req: Request, res: Response) => {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({
        type: 'https://supportpilot.io/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Query parameter tenantId is required for DLQ inspection',
      });
      return;
    }

    const records = queueManager.getDLQRecords(tenantId);
    res.json({
      tenantId,
      total: records.length,
      items: records,
    });
  });

  // POST /dlq/:id/replay
  router.post('/:id/replay', async (req: Request, res: Response) => {
    try {
      const dlqId = req.params.id as string;
      const tenantId = (req.body?.tenantId || req.query.tenantId) as string;

      if (!tenantId) {
        res.status(400).json({
          type: 'https://supportpilot.io/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'tenantId is required to replay a dead letter job',
        });
        return;
      }

      const result = await queueManager.replayDLQRecord(dlqId, tenantId);
      res.json({
        success: true,
        dlqId,
        newJobId: result.newJobId,
        message: 'Job replayed into source queue',
      });
    } catch (err) {
      res.status(404).json({
        type: 'https://supportpilot.io/errors/not-found',
        title: 'DLQ Replay Failed',
        status: 404,
        detail: (err as Error).message,
      });
    }
  });

  return router;
}
