import { Types } from 'mongoose';
import type { TicketEventType } from '@supportpilot/shared-types';
import { BaseTenantRepository, type TenantQueryFilter } from './base.repository.js';
import { TicketEvent, type ITicketEventDocument } from '../models/ticket-event.model.js';

export class TicketEventRepository extends BaseTenantRepository<ITicketEventDocument> {
  constructor(tenantId: string | Types.ObjectId) {
    super(tenantId, TicketEvent);
  }

  /** Record an event on a ticket's activity timeline (TKT-10) */
  async recordEvent(
    ticketId: string | Types.ObjectId,
    type: TicketEventType,
    options: {
      actorId?: string | Types.ObjectId;
      from?: string;
      to?: string;
      at?: Date;
    } = {},
  ): Promise<ITicketEventDocument> {
    const objectId = typeof ticketId === 'string' ? new Types.ObjectId(ticketId) : ticketId;

    const eventDoc: Partial<ITicketEventDocument> = {
      ticketId: objectId,
      type,
      from: options.from,
      to: options.to,
      at: options.at ?? new Date(),
    };

    if (options.actorId) {
      eventDoc.actorId =
        typeof options.actorId === 'string' ? new Types.ObjectId(options.actorId) : options.actorId;
    }

    return this.create(eventDoc);
  }

  /** Get full chronological activity timeline for a ticket */
  async getTimelineForTicket(ticketId: string | Types.ObjectId): Promise<ITicketEventDocument[]> {
    if (typeof ticketId === 'string' && !Types.ObjectId.isValid(ticketId)) {
      return [];
    }
    const objectId = typeof ticketId === 'string' ? new Types.ObjectId(ticketId) : ticketId;
    return this.model
      .find(this.scopeFilter({ ticketId: objectId } as TenantQueryFilter<ITicketEventDocument>))
      .sort({ at: 1 });
  }
}
