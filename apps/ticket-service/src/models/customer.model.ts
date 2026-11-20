import { Schema, model, type Document, type Types } from 'mongoose';

export interface ICustomerDocument extends Document {
  tenantId: Types.ObjectId;
  email: string;
  name: string;
  externalId?: string;
  visitorIds: string[];
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomerDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    externalId: {
      type: String,
      trim: true,
    },
    visitorIds: {
      type: [String],
      default: [],
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

customerSchema.index({ tenantId: 1, email: 1 }, { unique: true });
customerSchema.index({ tenantId: 1, externalId: 1 });
customerSchema.index({ tenantId: 1, lastSeenAt: -1 });
customerSchema.index(
  { tenantId: 1, name: 'text', email: 'text' },
  { weights: { name: 5, email: 10 }, name: 'customer_text_search' },
);

export const Customer = model<ICustomerDocument>('Customer', customerSchema);
