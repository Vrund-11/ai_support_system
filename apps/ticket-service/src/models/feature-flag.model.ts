import { Schema, model, type Document, type Types } from 'mongoose';

export interface IFeatureFlagDocument extends Document {
  tenantId: Types.ObjectId;
  key: string;
  name: string;
  enabled: boolean;
  description?: string;
  updatedAt: Date;
  createdAt: Date;
}

const featureFlagSchema = new Schema<IFeatureFlagDocument>(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

featureFlagSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const FeatureFlagModel = model<IFeatureFlagDocument>('FeatureFlag', featureFlagSchema);
