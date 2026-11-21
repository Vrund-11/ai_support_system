import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { Ticket } from '../models/ticket.model.js';
import { Types } from 'mongoose';

export const notificationRouter: Router = Router();
notificationRouter.use(requireAuth);

const readNotifications = new Set<string>();

// GET /api/v1/notifications — live notifications derived from tickets for user
notificationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.sub;

    const recentTickets = await Ticket.find({
      tenantId: new Types.ObjectId(tenantId),
      $or: [
        { assigneeId: new Types.ObjectId(userId) },
        { status: { $in: ['NEW', 'OPEN', 'PENDING_CUSTOMER'] } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean<
        Array<{
          _id: Types.ObjectId;
          status: string;
          number: number;
          subject: string;
          priority: string;
          updatedAt?: Date;
          createdAt?: Date;
        }>
      >();

    const items = recentTickets.map((t) => {
      const notifId = `notif_${t._id.toString()}`;
      return {
        id: notifId,
        title: t.status === 'NEW' ? 'New ticket created' : `Ticket #${t.number} updated`,
        message: `${t.subject} (${t.priority} priority)`,
        type: t.status === 'NEW' ? 'TICKET_ASSIGNED' : 'CUSTOMER_REPLY',
        read: readNotifications.has(notifId),
        ticketId: t._id.toString(),
        createdAt: (t.updatedAt || t.createdAt || new Date()).toISOString(),
      };
    });

    res.json({ data: items });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/v1/notifications/:id/read
notificationRouter.post('/:id/read', (req: Request, res: Response) => {
  readNotifications.add(req.params.id as string);
  res.status(200).json({ success: true });
});

// POST /api/v1/notifications/read-all
notificationRouter.post('/read-all', (_req: Request, res: Response) => {
  res.status(200).json({ success: true });
});
