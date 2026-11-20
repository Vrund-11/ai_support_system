import { Schema, model, type Document, type Types } from 'mongoose';
import type { TicketStatus, TicketPriority } from '@supportpilot/shared-types';

export interface ISlaRecord {
  firstResponseDue?: Date;
  resolveDue?: Date;
  firstRespondedAt?: Date;
  resolvedAt?: Date;
  breached?: boolean;
}

export interface ITicketDocument extends Document {
  tenantId: Types.ObjectId;
  number: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  priorityPredicted?: TicketPriority;
  category?: string;
  assigneeId?: Types.ObjectId;
  customerId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  tags: string[];
  customFields: Record<string, unknown>;
  sla: ISlaRecord;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicketDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    number: {
      type: Number,
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD', 'RESOLVED', 'CLOSED'],
      default: 'NEW',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    priorityPredicted: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    },
    category: {
      type: String,
      trim: true,
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    tags: {
      type: [String],
      default: [],
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sla: {
      firstResponseDue: { type: Date },
      resolveDue: { type: Date },
      firstRespondedAt: { type: Date },
      resolvedAt: { type: Date },
      breached: { type: Boolean, default: false },
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

ticketSchema.index({ tenantId: 1, number: 1 }, { unique: true });
ticketSchema.index({ tenantId: 1, status: 1, priority: 1, updatedAt: -1 });
ticketSchema.index({ tenantId: 1, assigneeId: 1, status: 1 });
ticketSchema.index({ tenantId: 1, tags: 1, status: 1 });
ticketSchema.index({ tenantId: 1, createdAt: -1 });
ticketSchema.index(
  { tenantId: 1, subject: 'text', description: 'text' },
  { weights: { subject: 10, description: 1 }, name: 'ticket_text_search' },
);

export const Ticket = model<ITicketDocument>('Ticket', ticketSchema);
