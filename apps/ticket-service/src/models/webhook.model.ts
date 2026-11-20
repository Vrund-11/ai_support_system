import { Schema, model, type Document, type Types } from 'mongoose';

export interface IWebhookSubscriptionDocument extends Document {
  tenantId: Types.ObjectId;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const webhookSubscriptionSchema = new Schema<IWebhookSubscriptionDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    events: {
      type: [String],
      required: true,
      default: ['ticket.created', 'ticket.updated', 'message.created'],
    },
    secret: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      maxlength: 255,
    },
  },
  {
    timestamps: true,
  },
);

webhookSubscriptionSchema.index({ tenantId: 1, active: 1 });

export const WebhookSubscriptionModel = model<IWebhookSubscriptionDocument>(
  'WebhookSubscription',
  webhookSubscriptionSchema,
);
