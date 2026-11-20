import { Router, type Request, type Response } from 'express';
import type { QueueManager } from '../manager.js';
import type { NotificationQueueName, BaseJobPayload } from '../types.js';
import { TestMailbox } from '../email/index.js';

export function createNotificationRoutes(
  queueManager: QueueManager,
  expectedServiceToken: string,
): Router {
  const router = Router();

  // Internal service token authentication middleware
  router.use((req: Request, res: Response, next) => {
    const token = req.headers['x-service-token'] as string;
    if (!token || token !== expectedServiceToken) {
      res.status(401).json({
        type: 'https://supportpilot.io/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Valid x-service-token header is required for notification service',
      });
      return;
    }
    next();
  });

  // POST /enqueue
  router.post('/enqueue', async (req: Request, res: Response) => {
    try {
      const { queue, data, options } = req.body as {
        queue: NotificationQueueName;
        data: BaseJobPayload;
        options?: { delay?: number; attempts?: number };
      };

      if (!queue || !data) {
        res.status(400).json({
          type: 'https://supportpilot.io/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'Missing queue or data in request body',
        });
        return;
      }

      if (!data.tenantId) {
        res.status(400).json({
          type: 'https://supportpilot.io/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'tenantId is required for notification jobs',
        });
        return;
      }

      const result = await queueManager.enqueue(queue, data, options);
      res.status(202).json({
        success: true,
        jobId: result.id,
        queue: result.queue,
      });
    } catch (err) {
      res.status(500).json({
        type: 'https://supportpilot.io/errors/internal',
        title: 'Queue Enqueue Failed',
        status: 500,
        detail: (err as Error).message,
      });
    }
  });

  // GET /metrics
  router.get('/metrics', async (_req: Request, res: Response) => {
    try {
      const metrics = await queueManager.getMetrics();
      res.json({ metrics });
    } catch (err) {
      res.status(500).json({
        type: 'https://supportpilot.io/errors/internal',
        title: 'Failed to Fetch Queue Metrics',
        status: 500,
        detail: (err as Error).message,
      });
    }
  });

  // GET /email/sent (Inspection for hermetic testing / audit)
  router.get('/email/sent', async (req: Request, res: Response) => {
    const to = req.query['to'] as string | undefined;
    const emails = to ? TestMailbox.findByRecipient(to) : TestMailbox.getAll();
    res.json({ emails });
  });

  return router;
}
