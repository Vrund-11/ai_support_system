import { Router, type Request, type Response, type NextFunction } from 'express';
import { Types } from 'mongoose';
import {
  createTicketSchema,
  updateTicketSchema,
  ticketFilterSchema,
  createMessageSchema,
  bulkTicketActionSchema,
} from '@supportpilot/validators';
import { AppError, executeRules } from '@supportpilot/shared-lib';
import type { RuleDto, TicketDto, TicketStatus } from '@supportpilot/shared-types';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { TicketEventRepository } from '../repositories/ticket-event.repository.js';
import { MessageRepository } from '../repositories/message.repository.js';
import { RuleRepository } from '../repositories/rule.repository.js';
import { Ticket } from '../models/ticket.model.js';
import { AssignmentService } from '../services/assignment.service.js';
import { validateStatusTransition } from '../lib/transitions.js';
import { isDbConnected } from '../lib/mongoose.js';

export const ticketRouter: Router = Router();

// POST /api/v1/tickets/public — public widget offline ticket submission (no agent auth required)
ticketRouter.post('/public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, name, email, subject, description, priority } = req.body;
    if (!tenantId || !email || !subject || !description) {
      throw new AppError(
        400,
        'tenantId, email, subject, and description are required',
        '/errors/validation',
      );
    }

    const { CustomerRepository } = await import('../repositories/customer.repository.js');
    const customerRepo = new CustomerRepository(tenantId);
    const customer = await customerRepo.createOrUpdate({
      name: name || email.split('@')[0],
      email,
      visitorIds: [],
    });

    const ticketRepo = new TicketRepository(tenantId);
    const ticket = await ticketRepo.createTicket({
      subject,
      description,
      priority: priority || 'MEDIUM',
      customerId: customer._id.toString(),
      tags: ['offline-widget'],
      attachments: [],
      customFields: {},
      linkedTicketIds: [],
    });

    res.status(201).json({
      data: {
        id: ticket._id.toString(),
        number: ticket.number,
        subject: ticket.subject,
        status: ticket.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tickets/public/track — public ticket tracking by number and customer email
ticketRouter.get('/public/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketNumber, email } = req.query;
    if (!ticketNumber || !email) {
      throw new AppError(400, 'ticketNumber and email are required', '/errors/validation');
    }

    const num = Number(ticketNumber);
    if (isNaN(num)) {
      throw new AppError(400, 'ticketNumber must be a valid number', '/errors/validation');
    }

    const emailStr = String(email).trim().toLowerCase();
    const { Customer } = await import('../models/customer.model.js');
    const customers = await Customer.find({ email: emailStr });
    const customerIds = customers.map((c) => c._id);

    const ticketQuery: Record<string, unknown> = {
      number: num,
      customerId: { $in: customerIds },
    };
    if (
      req.query['tenantId'] &&
      typeof req.query['tenantId'] === 'string' &&
      Types.ObjectId.isValid(req.query['tenantId'])
    ) {
      ticketQuery['tenantId'] = new Types.ObjectId(req.query['tenantId']);
    }

    const ticket = await Ticket.findOne(ticketQuery);
    if (!ticket) {
      throw new AppError(404, 'Ticket not found for provided email', '/errors/not-found');
    }

    const { MessageRepository } = await import('../repositories/message.repository.js');
    const { TicketEventRepository } = await import('../repositories/ticket-event.repository.js');
    const msgRepo = new MessageRepository(ticket.tenantId);
    const eventRepo = new TicketEventRepository(ticket.tenantId);

    const rawMessages = await msgRepo.getMessagesForTicket(ticket._id.toString(), {
      includeInternal: false,
    });
    const messages = rawMessages.map((m) => ({
      id: m._id.toString(),
      ticketId: m.ticketId ? m.ticketId.toString() : ticket._id.toString(),
      clientId: m.clientId,
      senderType: m.senderType,
      senderId: m.senderId ? m.senderId.toString() : '',
      body: m.body,
      isInternal: false,
      attachments: m.attachments || [],
      createdAt: m.createdAt.toISOString(),
    }));

    const rawTimeline = await eventRepo.getTimelineForTicket(ticket._id.toString());
    const timeline = rawTimeline.map((e) => ({
      id: e._id.toString(),
      ticketId: e.ticketId.toString(),
      type: e.type,
      actorId: e.actorId ? e.actorId.toString() : null,
      from: e.from,
      to: e.to,
      at: e.at.toISOString(),
      createdAt: e.createdAt.toISOString(),
    }));

    res.status(200).json({
      data: {
        ticket: {
          id: ticket._id.toString(),
          number: ticket.number,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
        },
        timeline,
        messages,
      },
    });
  } catch (err) {
    next(err);
  }
});

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
      items: result.items,
      nextCursor: result.nextCursor ?? null,
      hasMore: Boolean(result.nextCursor),
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
    if (!req.body.customerId) {
      if (!isDbConnected()) {
        req.body.customerId = new Types.ObjectId().toString();
      } else {
        const email = req.body.customerEmail || req.body.email || `customer-${Date.now()}@acme.com`;
        const { CustomerRepository } = await import('../repositories/customer.repository.js');
        const customerRepo = new CustomerRepository(req.user!.tenantId);
        const customer = await customerRepo.createOrUpdate({
          name: email.split('@')[0],
          email,
          visitorIds: [],
        });
        req.body.customerId = customer._id.toString();
      }
    }

    const parseResult = createTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;

    // Enforce strict tenant isolation on ticket attachments
    if (parseResult.data.attachments && parseResult.data.attachments.length > 0) {
      for (const att of parseResult.data.attachments) {
        if (!att.key.startsWith(`${tenantId}/`)) {
          throw new AppError(
            403,
            'Cross-tenant attachment access forbidden',
            '/errors/cross-tenant-access',
          );
        }
      }
    }

    const ticketRepo = new TicketRepository(tenantId);
    const ticket = await ticketRepo.createTicket(parseResult.data);

    // Evaluate automation rules (AUTO-3)
    try {
      const ruleRepo = new RuleRepository(tenantId);
      const activeRules = await ruleRepo.findActiveRules('TICKET_CREATED');
      if (activeRules && activeRules.length > 0) {
        const ruleDtos = activeRules.map(
          (r) => (typeof r.toJSON === 'function' ? r.toJSON() : r) as RuleDto,
        );
        const ticketData = typeof ticket.toJSON === 'function' ? ticket.toJSON() : ticket;
        const evalResult = executeRules(ruleDtos, { ticket: ticketData as unknown as TicketDto });
        if (Object.keys(evalResult.changes).length > 0) {
          const ticketId = ticket._id;
          await ticketRepo.updateById(ticketId, evalResult.changes);
          Object.assign(ticket, evalResult.changes);
        }
      }
    } catch {
      // Continue without failing ticket creation if rule query fails
    }

    const ticketPayload = typeof ticket.toJSON === 'function' ? ticket.toJSON() : (ticket as any);
    if (!ticketPayload.id && ticket._id) {
      ticketPayload.id = ticket._id.toString();
    }

    res.status(201).json({ data: ticketPayload });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tickets/assignment/next-agent — preview next agent assignment (TKT-4)
ticketRouter.get(
  '/assignment/next-agent',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const algorithm = req.query['algorithm'] === 'least-loaded' ? 'least-loaded' : 'round-robin';
      const agentId = await AssignmentService.getNextAgent(tenantId, algorithm);
      res.status(200).json({ data: { agentId, algorithm } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/tickets/bulk — bulk ticket actions (TKT-8)
ticketRouter.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = bulkTicketActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const actorId = req.user!.sub;
    const { ticketIds, action, value } = parseResult.data;
    const eventRepo = new TicketEventRepository(tenantId);
    const updatedIds: string[] = [];

    for (const idStr of ticketIds) {
      if (!Types.ObjectId.isValid(idStr)) continue;
      const objId = new Types.ObjectId(idStr);
      const ticket = await Ticket.findOne({
        _id: objId,
        tenantId: new Types.ObjectId(tenantId),
      });
      if (!ticket) continue;

      if (action === 'ASSIGN') {
        const newAssignee =
          value === 'auto'
            ? await AssignmentService.getNextAgent(tenantId, 'round-robin')
            : value
              ? String(value)
              : null;

        ticket.assigneeId = newAssignee ? new Types.ObjectId(newAssignee) : undefined;
        ticket.version += 1;
        await ticket.save();

        await eventRepo.recordEvent(objId, 'ASSIGN', {
          actorId,
          from: ticket.assigneeId ? ticket.assigneeId.toString() : 'unassigned',
          to: newAssignee ?? 'unassigned',
        });
        updatedIds.push(idStr);
      } else if (action === 'TAG') {
        const tagToAdd = Array.isArray(value) ? value : [String(value)];
        ticket.tags = Array.from(new Set([...ticket.tags, ...tagToAdd]));
        ticket.version += 1;
        await ticket.save();

        await eventRepo.recordEvent(objId, 'TAG', {
          actorId,
          from: '',
          to: tagToAdd.join(', '),
        });
        updatedIds.push(idStr);
      } else if (action === 'STATUS') {
        const targetStatus = String(value) as TicketStatus;
        try {
          validateStatusTransition(ticket.status, targetStatus);
        } catch {
          // If transition is invalid for this ticket, skip
          continue;
        }
        const oldStatus = ticket.status;
        ticket.status = targetStatus;
        ticket.version += 1;
        await ticket.save();

        await eventRepo.recordEvent(objId, 'STATUS', {
          actorId,
          from: oldStatus,
          to: targetStatus,
        });
        updatedIds.push(idStr);
      }
    }

    res.status(200).json({
      data: {
        updatedCount: updatedIds.length,
        ticketIds: updatedIds,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tickets/:id/link — link tickets bidirectionally (TKT-6)
ticketRouter.post('/:id/link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    const { targetTicketId } = req.body as { targetTicketId?: string };

    if (!targetTicketId || !Types.ObjectId.isValid(targetTicketId)) {
      throw new AppError(400, 'Valid targetTicketId is required', '/errors/validation');
    }
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    const tenantId = req.user!.tenantId;
    const tenantObjectId = new Types.ObjectId(tenantId);
    const sourceObjId = new Types.ObjectId(ticketId);
    const targetObjId = new Types.ObjectId(targetTicketId);

    const [sourceTicket, targetTicket] = await Promise.all([
      Ticket.findOne({ _id: sourceObjId, tenantId: tenantObjectId }),
      Ticket.findOne({ _id: targetObjId, tenantId: tenantObjectId }),
    ]);

    if (!sourceTicket || !targetTicket) {
      throw new AppError(404, 'One or both tickets not found', '/errors/not-found');
    }

    if (!sourceTicket.linkedTicketIds) {
      sourceTicket.linkedTicketIds = [];
    }
    if (!sourceTicket.linkedTicketIds.some((id) => id.equals(targetObjId))) {
      sourceTicket.linkedTicketIds.push(targetObjId);
      sourceTicket.version += 1;
      await sourceTicket.save();
    }

    if (!targetTicket.linkedTicketIds) {
      targetTicket.linkedTicketIds = [];
    }
    if (!targetTicket.linkedTicketIds.some((id) => id.equals(sourceObjId))) {
      targetTicket.linkedTicketIds.push(sourceObjId);
      targetTicket.version += 1;
      await targetTicket.save();
    }

    const result =
      typeof sourceTicket.toJSON === 'function' ? sourceTicket.toJSON() : (sourceTicket as any);
    if (!result.id && sourceTicket._id) {
      result.id = sourceTicket._id.toString();
    }

    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tickets/:id — get ticket details with activity timeline and messages (TKT-5, 10)
ticketRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }
    const tenantId = req.user!.tenantId;
    const ticketRepo = new TicketRepository(tenantId);
    const ticket = await ticketRepo.findById(ticketId);

    if (!ticket) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    const eventRepo = new TicketEventRepository(tenantId);
    const messageRepo = new MessageRepository(tenantId);

    const [events, messages] = await Promise.all([
      eventRepo.getTimelineForTicket(ticketId),
      messageRepo.getMessagesForTicket(ticketId, { includeInternal: true }),
    ]);

    const ticketObj =
      typeof ticket.toJSON === 'function'
        ? ticket.toJSON()
        : typeof ticket.toObject === 'function'
          ? ticket.toObject()
          : ticket;
    if (!ticketObj.id && ticket._id) {
      ticketObj.id = ticket._id.toString();
    }

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
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }
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

    const updatedData = typeof updated.toJSON === 'function' ? updated.toJSON() : (updated as any);
    if (!updatedData.id && updated._id) {
      updatedData.id = updated._id.toString();
    }

    res.status(200).json({ data: updatedData });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tickets/:id/messages — add message or internal note (TKT-5)
ticketRouter.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }
    const parseResult = createMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const actorId = req.user!.sub;

    // Enforce strict tenant isolation on message attachments
    if (parseResult.data.attachments && parseResult.data.attachments.length > 0) {
      for (const att of parseResult.data.attachments) {
        if (!att.key.startsWith(`${tenantId}/`)) {
          throw new AppError(
            403,
            'Cross-tenant attachment access forbidden',
            '/errors/cross-tenant-access',
          );
        }
      }
    }

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
