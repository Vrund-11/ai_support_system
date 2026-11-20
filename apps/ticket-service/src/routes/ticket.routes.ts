import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  createTicketSchema,
  updateTicketSchema,
  ticketFilterSchema,
  createMessageSchema,
} from '@supportpilot/validators';
import { AppError } from '@supportpilot/shared-lib';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { TicketEventRepository } from '../repositories/ticket-event.repository.js';
import { MessageRepository } from '../repositories/message.repository.js';

export const ticketRouter: Router = Router();

// Enforce AGENT+ on all ticket endpoints (PRD section 8.1)
ticketRouter.use(requireAuth, requireMinRole('AGENT'));

// GET /api/v1/tickets — list with filters and cursor pagination
ticketRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = ticketFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const ticketRepo = new TicketRepository(tenantId);
    const result = await ticketRepo.listTickets(parseResult.data);

    res.status(200).json({
      data: result.items,
      meta: {
        cursor: result.nextCursor,
        hasMore: Boolean(result.nextCursor),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tickets — create ticket
ticketRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = createTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const ticketRepo = new TicketRepository(tenantId);
    const ticket = await ticketRepo.createTicket(parseResult.data);

    res.status(201).json({ data: ticket });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tickets/:id — get ticket details with activity timeline and messages (TKT-5, 10)
ticketRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    const tenantId = req.user!.tenantId;
    const ticketRepo = new TicketRepository(tenantId);
    const eventRepo = new TicketEventRepository(tenantId);
    const messageRepo = new MessageRepository(tenantId);

    const [ticket, events, messages] = await Promise.all([
      ticketRepo.findById(ticketId),
      eventRepo.getTimelineForTicket(ticketId),
      messageRepo.getMessagesForTicket(ticketId, { includeInternal: true }),
    ]);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    const ticketObj = typeof ticket.toObject === 'function' ? ticket.toObject() : ticket;

    res.status(200).json({
      data: {
        ...ticketObj,
        events,
        messages,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tickets/:id — update with optimistic concurrency control (version)
ticketRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    const parseResult = updateTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const actorId = req.user!.sub;
    const ticketRepo = new TicketRepository(tenantId);
    const { version, ...updateFields } = parseResult.data;

    const updated = await ticketRepo.updateTicketWithVersion(
      ticketId,
      version,
      updateFields,
      actorId,
    );

    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tickets/:id/messages — add message or internal note (TKT-5)
ticketRouter.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    const parseResult = createMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const actorId = req.user!.sub;
    const ticketRepo = new TicketRepository(tenantId);
    const ticket = await ticketRepo.findById(ticketId);
    if (!ticket) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    const messageRepo = new MessageRepository(tenantId);
    const message = await messageRepo.addMessageToTicket(ticketId, parseResult.data, {
      senderId: actorId,
      senderType: 'AGENT',
    });

    res.status(201).json({ data: message });
  } catch (err) {
    next(err);
  }
});
