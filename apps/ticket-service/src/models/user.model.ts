import { Schema, model, type Document, type Types } from 'mongoose';
import type { Role, UserStatus, DeviceToken, NotificationPrefs } from '@supportpilot/shared-types';

export interface IUserDocument extends Document {
  tenantId: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  status: UserStatus;
  lastLoginAt?: Date;
  deviceTokens: DeviceToken[];
  notificationPrefs: NotificationPrefs;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>(
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
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['PLATFORM_ADMIN', 'OWNER', 'LEAD', 'AGENT', 'VIEWER'],
      default: 'AGENT',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INVITED', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    lastLoginAt: {
      type: Date,
    },
    deviceTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, enum: ['IOS', 'ANDROID', 'WEB'], required: true },
        lastSeen: { type: String, required: true },
      },
    ],
    notificationPrefs: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes required by PRD and Data Model specs
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });

export const User = model<IUserDocument>('User', userSchema);
