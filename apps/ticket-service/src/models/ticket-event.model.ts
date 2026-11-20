import { Schema, model, type Document, type Types } from 'mongoose';
import type { TicketEventType } from '@supportpilot/shared-types';

export interface ITicketEventDocument extends Document {
  tenantId: Types.ObjectId;
  ticketId: Types.ObjectId;
  actorId?: Types.ObjectId;
  type: TicketEventType;
  from?: string;
  to?: string;
  at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketEventSchema = new Schema<ITicketEventDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: ['STATUS', 'PRIORITY', 'ASSIGN', 'NOTE', 'MESSAGE', 'SLA', 'TAG'],
      required: true,
    },
    from: { type: String },
    to: { type: String },
    at: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

ticketEventSchema.index({ tenantId: 1, ticketId: 1, at: 1 });

export const TicketEvent = model<ITicketEventDocument>('TicketEvent', ticketEventSchema);
