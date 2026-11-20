import { Schema, model, type Document, type Types } from 'mongoose';

export interface IApiKeyDocument extends Document {
  tenantId: Types.ObjectId;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const apiKeySchema = new Schema<IApiKeyDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    prefix: {
      type: String,
      required: true,
      maxlength: 20,
    },
    scopes: {
      type: [String],
      default: ['tickets:read', 'tickets:write'],
    },
    lastUsedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

apiKeySchema.index({ tenantId: 1, revokedAt: 1 });

export const ApiKeyModel = model<IApiKeyDocument>('ApiKey', apiKeySchema);
