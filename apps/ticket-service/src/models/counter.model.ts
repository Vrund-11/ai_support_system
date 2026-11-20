import { Schema, model, type Document, type Types } from 'mongoose';

export interface ICounterDocument extends Document {
  tenantId: Types.ObjectId;
  key: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const counterSchema = new Schema<ICounterDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

counterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const Counter = model<ICounterDocument>('Counter', counterSchema);
