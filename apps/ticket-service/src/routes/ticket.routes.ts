import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  createTicketSchema,
  updateTicketSchema,
  ticketFilterSchema,
} from '@supportpilot/validators';
import { AppError } from '@supportpilot/shared-lib';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import { TicketRepository } from '../repositories/ticket.repository.js';

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

// GET /api/v1/tickets/:id — get ticket details
ticketRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    const tenantId = req.user!.tenantId;
    const ticketRepo = new TicketRepository(tenantId);
    const ticket = await ticketRepo.findById(ticketId);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    res.status(200).json({ data: ticket });
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
    const ticketRepo = new TicketRepository(tenantId);
    const { version, ...updateFields } = parseResult.data;

    const updated = await ticketRepo.updateTicketWithVersion(ticketId, version, updateFields);

    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});
