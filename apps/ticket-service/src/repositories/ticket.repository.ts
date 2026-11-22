import { Types } from 'mongoose';
import { AppError } from '@supportpilot/shared-lib';
import type {
  CreateTicketInput,
  UpdateTicketInput,
  TicketFilterInput,
} from '@supportpilot/validators';
import {
  BaseTenantRepository,
  type PaginatedResult,
  type TenantQueryFilter,
} from './base.repository.js';
import { Ticket, type ITicketDocument } from '../models/ticket.model.js';
import { Counter } from '../models/counter.model.js';
import { validateStatusTransition } from '../lib/transitions.js';
import { TicketEventRepository } from './ticket-event.repository.js';
import { getRedis } from '../lib/redis.js';
import { isDbConnected } from '../lib/mongoose.js';

export class TicketRepository extends BaseTenantRepository<ITicketDocument> {
  private readonly eventRepo: TicketEventRepository;

  constructor(tenantId: string | Types.ObjectId) {
    super(tenantId, Ticket);
    this.eventRepo = new TicketEventRepository(this.tenantId);
  }

  /** Reconcile sequence counter to match the maximum existing ticket number in MongoDB */
  async reconcileCounter(): Promise<number> {
    let maxNum = 0;
    try {
      let latestTicket: any = null;
      if (isDbConnected() || (Ticket.findOne as any).mock) {
        const query: any = Ticket.findOne({ tenantId: this.tenantId });
        if (query && typeof query.sort === 'function') {
          const sorted = query.sort({ number: -1 });
          const selected = typeof sorted?.select === 'function' ? sorted.select('number') : sorted;
          latestTicket =
            typeof selected?.lean === 'function' ? await selected.lean() : await selected;
        } else if (query) {
          latestTicket = await query;
        }
      }

      let latestCounter: any = null;
      if (isDbConnected() || (Counter.findOne as any).mock) {
        const counterQuery: any = Counter.findOne({
          tenantId: this.tenantId,
          key: 'ticket_number',
        });
        latestCounter =
          counterQuery && typeof counterQuery.lean === 'function'
            ? await counterQuery.lean()
            : await counterQuery;
      }

      maxNum = Math.max(0, latestTicket?.number ?? 0, latestCounter?.value ?? 0);
    } catch {
      maxNum = 0;
    }

    try {
      const redis = getRedis();
      const key = `seq:${this.tenantId}:ticket`;
      await redis.set(key, maxNum);
    } catch {}

    if (isDbConnected() || (Counter.findOneAndUpdate as any).mock) {
      try {
        await Counter.findOneAndUpdate(
          { tenantId: this.tenantId, key: 'ticket_number' },
          { $set: { value: maxNum } },
          { upsert: true },
        );
      } catch {}
    }

    return maxNum;
  }

  /**
   * Atomic per-tenant sequence counter for ticket numbers (1, 2, 3...)
   * Fast path: Redis INCR seq:{tenantId}:ticket.
   * Cold miss fallback: Queries DB max and initializes Redis via SET ... NX.
   * Total offline fallback: MongoDB Counter.findOneAndUpdate.
   */
  async getNextTicketNumber(): Promise<number> {
    const key = `seq:${this.tenantId}:ticket`;

    try {
      const redis = getRedis();
      const exists = await redis.exists(key);

      if (!exists) {
        // Cold start or evicted cache: discover max from DB and initialize with NX
        let maxNum = 0;
        try {
          let latestTicket: any = null;
          if (isDbConnected() || (Ticket.findOne as any).mock) {
            const query: any = Ticket.findOne({ tenantId: this.tenantId });
            if (query && typeof query.sort === 'function') {
              const sorted = query.sort({ number: -1 });
              const selected =
                typeof sorted?.select === 'function' ? sorted.select('number') : sorted;
              latestTicket =
                typeof selected?.lean === 'function' ? await selected.lean() : await selected;
            } else if (query) {
              latestTicket = await query;
            }
          }

          let latestCounter: any = null;
          if (isDbConnected() || (Counter.findOne as any).mock) {
            const counterQuery: any = Counter.findOne({
              tenantId: this.tenantId,
              key: 'ticket_number',
            });
            latestCounter =
              counterQuery && typeof counterQuery.lean === 'function'
                ? await counterQuery.lean()
                : await counterQuery;
          }

          maxNum = Math.max(0, latestTicket?.number ?? 0, latestCounter?.value ?? 0);
        } catch {
          maxNum = 0;
        }

        await redis.set(key, maxNum, 'NX');
      }

      return await redis.incr(key);
    } catch {
      // Redis unavailable: fallback gracefully to MongoDB atomic counter
      const counter = await Counter.findOneAndUpdate(
        { tenantId: this.tenantId, key: 'ticket_number' },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return counter?.value ?? 1;
    }
  }

  /**
   * Create ticket with atomic ticket number and initial version 1.
   * Protected with collision retry loop against MongoDB code 11000 duplicate key error.
   */
  async createTicket(input: CreateTicketInput): Promise<ITicketDocument> {
    const MAX_RETRIES = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const number = await this.getNextTicketNumber();

      const ticketDoc: Partial<ITicketDocument> = {
        number,
        subject: input.subject,
        description: input.description,
        customerId: new Types.ObjectId(input.customerId),
        status: 'NEW',
        priority: input.priority,
        tags: input.tags,
        attachments: input.attachments ?? [],
        customFields: input.customFields,
        linkedTicketIds: (input.linkedTicketIds ?? []).map((id) => new Types.ObjectId(id)),
        version: 1,
        sla: { breached: false },
      };

      if (input.assigneeId) {
        ticketDoc.assigneeId = new Types.ObjectId(input.assigneeId);
      }

      try {
        return await this.create(ticketDoc);
      } catch (err: any) {
        if (err?.code === 11000 || err?.message?.includes('E11000 duplicate key')) {
          lastError = err;
          await this.reconcileCounter();
          continue;
        }
        throw err;
      }
    }

    throw new AppError(
      500,
      `Failed to allocate unique ticket number after ${MAX_RETRIES} attempts due to concurrency: ${lastError?.message || 'duplicate key collision'}`,
    );
  }

  /** List tickets with filters and cursor-based pagination */
  async listTickets(filterInput: TicketFilterInput): Promise<PaginatedResult<ITicketDocument>> {
    const query: TenantQueryFilter<ITicketDocument> = {} as TenantQueryFilter<ITicketDocument>;

    if (filterInput.status) {
      const statuses = Array.isArray(filterInput.status)
        ? filterInput.status
        : [filterInput.status];
      query['status'] = { $in: statuses };
    }

    if (filterInput.priority) {
      const priorities = Array.isArray(filterInput.priority)
        ? filterInput.priority
        : [filterInput.priority];
      query['priority'] = { $in: priorities };
    }

    const assignee = filterInput.assigneeId || filterInput.assignedAgentId;
    if (assignee && Types.ObjectId.isValid(assignee)) {
      query['assigneeId'] = new Types.ObjectId(assignee);
    }

    if (filterInput.tag) {
      query['tags'] = { $in: [filterInput.tag] };
    }

    if (filterInput.q) {
      query['$text'] = { $search: filterInput.q };
    }

    if (filterInput.from || filterInput.to) {
      const dateFilter: Record<string, Date> = {};
      if (filterInput.from) dateFilter['$gte'] = new Date(filterInput.from);
      if (filterInput.to) dateFilter['$lte'] = new Date(filterInput.to);
      query['createdAt'] = dateFilter;
    }

    return this.findWithPagination(query, {
      limit: filterInput.limit,
      cursor: filterInput.cursor,
      sort: { updatedAt: -1, _id: -1 },
    });
  }

  /**
   * Explain query execution plan for listTickets (TKT-7).
   * Calls .explain('executionStats') to measure index usage and query performance.
   */
  async explainListTickets(filterInput: TicketFilterInput): Promise<Record<string, unknown>> {
    const query: TenantQueryFilter<ITicketDocument> = {} as TenantQueryFilter<ITicketDocument>;

    if (filterInput.status) {
      const statuses = Array.isArray(filterInput.status)
        ? filterInput.status
        : [filterInput.status];
      query['status'] = { $in: statuses };
    }

    if (filterInput.priority) {
      const priorities = Array.isArray(filterInput.priority)
        ? filterInput.priority
        : [filterInput.priority];
      query['priority'] = { $in: priorities };
    }

    const assignee = filterInput.assigneeId || filterInput.assignedAgentId;
    if (assignee && Types.ObjectId.isValid(assignee)) {
      query['assigneeId'] = new Types.ObjectId(assignee);
    }

    if (filterInput.tag) {
      query['tags'] = { $in: [filterInput.tag] };
    }

    if (filterInput.q) {
      query['$text'] = { $search: filterInput.q };
    }

    if (filterInput.from || filterInput.to) {
      const dateFilter: Record<string, Date> = {};
      if (filterInput.from) dateFilter['$gte'] = new Date(filterInput.from);
      if (filterInput.to) dateFilter['$lte'] = new Date(filterInput.to);
      query['createdAt'] = dateFilter;
    }

    let queryObj: any = this.model.find(this.scopeFilter(query));
    if (typeof queryObj.sort === 'function') {
      queryObj = queryObj.sort({ updatedAt: -1, _id: -1 });
    }
    if (typeof queryObj.limit === 'function') {
      queryObj = queryObj.limit(Math.min(filterInput.limit ?? 20, 50));
    }

    const explained = await (
      queryObj as unknown as {
        explain: (verbosity: string) => Promise<Record<string, unknown>>;
      }
    ).explain('executionStats');

    return explained;
  }

  /**
   * Update ticket with optimistic concurrency control (TKT-9).
   * Verifies version before updating. Increments version on success.
   * Throws 409 Conflict if version does not match existing ticket.
   */
  async updateTicketWithVersion(
    id: string | Types.ObjectId,
    version: number,
    updateData: Omit<UpdateTicketInput, 'version'>,
    actorId?: string | Types.ObjectId,
  ): Promise<ITicketDocument> {
    if (typeof id === 'string' && !Types.ObjectId.isValid(id)) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    const objectId = typeof id === 'string' ? new Types.ObjectId(id) : id;

    // Check existing ticket to validate status transitions and ensure existence
    const existing = await this.findById(objectId);
    if (!existing) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    if (updateData.status && updateData.status !== existing.status) {
      validateStatusTransition(existing.status, updateData.status);
    }

    const updateFields: Record<string, unknown> = {};
    if (updateData.status) updateFields['status'] = updateData.status;
    if (updateData.priority) updateFields['priority'] = updateData.priority;
    if (updateData.assigneeId !== undefined) {
      updateFields['assigneeId'] = updateData.assigneeId
        ? new Types.ObjectId(updateData.assigneeId)
        : null;
    }
    if (updateData.tags !== undefined) updateFields['tags'] = updateData.tags;
    if (updateData.customFields !== undefined)
      updateFields['customFields'] = updateData.customFields;
    if (updateData.linkedTicketIds !== undefined) {
      updateFields['linkedTicketIds'] = updateData.linkedTicketIds.map(
        (id) => new Types.ObjectId(id),
      );
    }

    // Attempt atomic update matching tenantId, _id and version
    const updated = await this.model.findOneAndUpdate(
      this.scopeFilter({ _id: objectId, version } as TenantQueryFilter<ITicketDocument>),
      {
        $set: updateFields,
        $inc: { version: 1 },
      },
      { new: true },
    );

    if (updated) {
      // Record activity timeline events for each changed field (TKT-10)
      if (updateData.status && updateData.status !== existing.status) {
        await this.eventRepo.recordEvent(objectId, 'STATUS', {
          actorId,
          from: existing.status,
          to: updateData.status,
        });
      }

      if (updateData.priority && updateData.priority !== existing.priority) {
        await this.eventRepo.recordEvent(objectId, 'PRIORITY', {
          actorId,
          from: existing.priority,
          to: updateData.priority,
        });
      }

      if (
        updateData.assigneeId !== undefined &&
        String(updateData.assigneeId) !== String(existing.assigneeId)
      ) {
        await this.eventRepo.recordEvent(objectId, 'ASSIGN', {
          actorId,
          from: existing.assigneeId ? existing.assigneeId.toString() : 'unassigned',
          to: updateData.assigneeId ? updateData.assigneeId.toString() : 'unassigned',
        });
      }

      if (updateData.tags && JSON.stringify(updateData.tags) !== JSON.stringify(existing.tags)) {
        await this.eventRepo.recordEvent(objectId, 'TAG', {
          actorId,
          from: existing.tags.join(', '),
          to: updateData.tags.join(', '),
        });
      }

      return updated;
    }

    // Update failed. Version mismatch since document existence was confirmed above
    const current = await this.findById(objectId);
    const currentVersion = current?.version ?? 'unknown';

    throw new AppError(
      409,
      `Conflict: ticket has been modified concurrently. Expected version ${version}, but current version is ${currentVersion}.`,
      '/errors/version-conflict',
    );
  }
}
