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

export class TicketRepository extends BaseTenantRepository<ITicketDocument> {
  constructor(tenantId: string | Types.ObjectId) {
    super(tenantId, Ticket);
  }

  /** Atomic per-tenant sequence counter for ticket numbers (1, 2, 3...) */
  async getNextTicketNumber(): Promise<number> {
    const counter = await Counter.findOneAndUpdate(
      { tenantId: this.tenantId, key: 'ticket_number' },
      { $inc: { value: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return counter?.value ?? 1;
  }

  /** Create ticket with atomic ticket number and initial version 1 */
  async createTicket(input: CreateTicketInput): Promise<ITicketDocument> {
    const number = await this.getNextTicketNumber();

    const ticketDoc: Partial<ITicketDocument> = {
      number,
      subject: input.subject,
      description: input.description,
      customerId: new Types.ObjectId(input.customerId),
      status: 'NEW',
      priority: input.priority,
      tags: input.tags,
      customFields: input.customFields,
      version: 1,
      sla: { breached: false },
    };

    if (input.assigneeId) {
      ticketDoc.assigneeId = new Types.ObjectId(input.assigneeId);
    }

    return this.create(ticketDoc);
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

    if (filterInput.assigneeId && Types.ObjectId.isValid(filterInput.assigneeId)) {
      query['assigneeId'] = new Types.ObjectId(filterInput.assigneeId);
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
      sort: { _id: -1 },
    });
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
  ): Promise<ITicketDocument> {
    if (typeof id === 'string' && !Types.ObjectId.isValid(id)) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    const objectId = typeof id === 'string' ? new Types.ObjectId(id) : id;

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
      return updated;
    }

    // Update failed. Check if ticket exists to distinguish 404 from 409 version conflict
    const existing = await this.findById(objectId);
    if (!existing) {
      throw new AppError(404, 'Ticket not found', '/errors/not-found');
    }

    throw new AppError(
      409,
      `Conflict: ticket has been modified concurrently. Expected version ${version}, but current version is ${existing.version}.`,
      '/errors/version-conflict',
    );
  }
}
