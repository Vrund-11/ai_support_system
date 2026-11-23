import { Types } from 'mongoose';
import type { SenderType } from '@supportpilot/shared-types';
import type { CreateMessageInput } from '@supportpilot/validators';
import { BaseTenantRepository, type TenantQueryFilter } from './base.repository.js';
import { Message, type IMessageDocument } from '../models/message.model.js';
import { Counter } from '../models/counter.model.js';
import { TicketEventRepository } from './ticket-event.repository.js';

export class MessageRepository extends BaseTenantRepository<IMessageDocument> {
  private readonly eventRepo: TicketEventRepository;

  constructor(tenantId: string | Types.ObjectId) {
    super(tenantId, Message);
    this.eventRepo = new TicketEventRepository(this.tenantId);
  }

  /** Get next sequential message number for a ticket thread */
  async getNextMessageSeq(ticketId: Types.ObjectId): Promise<number> {
    const counter = await Counter.findOneAndUpdate(
      { tenantId: this.tenantId, key: `ticket_msg_seq:${ticketId.toString()}` },
      { $inc: { value: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return counter?.value ?? 1;
  }

  /**
   * Add a message (reply or internal note) to a ticket thread (TKT-5).
   * Generates sequential seq number and records an activity timeline event.
   */
  async addMessageToTicket(
    ticketId: string | Types.ObjectId,
    input: CreateMessageInput,
    options: {
      senderId?: string | Types.ObjectId;
      senderType?: SenderType;
    } = {},
  ): Promise<IMessageDocument> {
    const objectId = typeof ticketId === 'string' ? new Types.ObjectId(ticketId) : ticketId;

    if (input.clientId) {
      const existing = await this.model.findOne({
        tenantId: this.tenantId,
        ticketId: objectId,
        clientId: input.clientId,
      });
      if (existing) {
        return existing;
      }
    }

    const seq = await this.getNextMessageSeq(objectId);
    const senderType = options.senderType ?? 'AGENT';
    const isInternal = Boolean(input.isInternal);

    const messageDoc: Partial<IMessageDocument> = {
      ticketId: objectId,
      clientId: input.clientId,
      seq,
      senderType,
      body: input.body,
      isInternal,
      attachments: input.attachments ?? [],
      citations: [],
      readBy: [],
    };

    if (options.senderId) {
      messageDoc.senderId =
        typeof options.senderId === 'string'
          ? new Types.ObjectId(options.senderId)
          : options.senderId;
    }

    let message: IMessageDocument;
    try {
      message = await this.create(messageDoc);
    } catch (err: any) {
      if ((err?.code === 11000 || err?.name === 'MongoServerError') && input.clientId) {
        const existing = await this.model.findOne({
          tenantId: this.tenantId,
          ticketId: objectId,
          clientId: input.clientId,
        });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }

    // Record timeline event
    await this.eventRepo.recordEvent(objectId, isInternal ? 'NOTE' : 'MESSAGE', {
      actorId: options.senderId,
      to: input.body.length > 80 ? `${input.body.slice(0, 80)}...` : input.body,
    });

    return message;
  }

  /** Get messages for a ticket thread */
  async getMessagesForTicket(
    ticketId: string | Types.ObjectId,
    options: { includeInternal?: boolean } = {},
  ): Promise<IMessageDocument[]> {
    if (typeof ticketId === 'string' && !Types.ObjectId.isValid(ticketId)) {
      return [];
    }
    const objectId = typeof ticketId === 'string' ? new Types.ObjectId(ticketId) : ticketId;
    const filter: Record<string, unknown> = { ticketId: objectId };

    if (!options.includeInternal) {
      filter['isInternal'] = false;
    }

    return this.model
      .find(this.scopeFilter(filter as TenantQueryFilter<IMessageDocument>))
      .sort({ seq: 1 });
  }
}
