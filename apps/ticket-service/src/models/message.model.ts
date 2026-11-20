import { Schema, model, type Document, type Types } from 'mongoose';
import type { SenderType, Attachment, Citation } from '@supportpilot/shared-types';

export interface IMessageDocument extends Document {
  tenantId: Types.ObjectId;
  ticketId?: Types.ObjectId;
  conversationId?: Types.ObjectId;
  seq: number;
  senderType: SenderType;
  senderId?: Types.ObjectId;
  body: string;
  citations: Citation[];
  attachments: Attachment[];
  isInternal: boolean;
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessageDocument>(
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
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true,
    },
    seq: {
      type: Number,
      required: true,
    },
    senderType: {
      type: String,
      enum: ['CUSTOMER', 'AI', 'AGENT', 'SYSTEM'],
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    citations: [
      {
        chunkId: { type: String, required: true },
        docId: { type: String, required: true },
        title: { type: String, required: true },
      },
    ],
    attachments: [
      {
        key: { type: String, required: true },
        name: { type: String, required: true },
        size: { type: Number, required: true },
        mime: { type: String, required: true },
      },
    ],
    isInternal: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  },
);

messageSchema.index({ tenantId: 1, ticketId: 1, seq: 1 });
messageSchema.index({ conversationId: 1, seq: 1 });
messageSchema.index({ body: 'text' });

export const Message = model<IMessageDocument>('Message', messageSchema);
