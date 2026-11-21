import { Schema, model, type Document } from 'mongoose';
import type { TenantSettings, TenantPlan, TenantStatus } from '@supportpilot/shared-types';

export interface TenantQuotas {
  maxUsers: number;
  maxTicketsPerMonth: number;
  maxAiTokensPerMonth: number;
  vectorLimitGb: number;
}

export interface ITenantDocument extends Document {
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  widgetKey: string;
  settings: TenantSettings;
  quotas?: TenantQuotas;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const defaultTenantSettings: TenantSettings = {
  brand: {
    color: '#2563eb',
  },
  businessHours: [
    { day: 1, start: '09:00', end: '17:00' }, // Mon
    { day: 2, start: '09:00', end: '17:00' }, // Tue
    { day: 3, start: '09:00', end: '17:00' }, // Wed
    { day: 4, start: '09:00', end: '17:00' }, // Thu
    { day: 5, start: '09:00', end: '17:00' }, // Fri
  ],
  timezone: 'UTC',
  sla: {
    LOW: { firstResponseMin: 480, resolveMin: 1440 },
    MEDIUM: { firstResponseMin: 240, resolveMin: 720 },
    HIGH: { firstResponseMin: 60, resolveMin: 240 },
    URGENT: { firstResponseMin: 15, resolveMin: 60 },
  },
  aiEnabled: true,
  aiThreshold: 0.55,
};

const tenantSchema = new Schema<ITenantDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['FREE', 'PRO'],
      default: 'FREE',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    widgetKey: {
      type: String,
      required: true,
    },
    stripeCustomerId: {
      type: String,
    },
    stripeSubscriptionId: {
      type: String,
    },
    quotas: {
      maxUsers: { type: Number, default: 30 },
      maxTicketsPerMonth: { type: Number, default: 20000 },
      maxAiTokensPerMonth: { type: Number, default: 10000000 },
      vectorLimitGb: { type: Number, default: 10 },
    },
    settings: {
      brand: {
        color: { type: String, default: defaultTenantSettings.brand.color },
        logoUrl: { type: String },
      },
      businessHours: {
        type: [
          {
            day: { type: Number, min: 0, max: 6 },
            start: { type: String },
            end: { type: String },
          },
        ],
        default: defaultTenantSettings.businessHours,
      },
      timezone: { type: String, default: defaultTenantSettings.timezone },
      sla: {
        LOW: {
          firstResponseMin: { type: Number, default: 480 },
          resolveMin: { type: Number, default: 1440 },
        },
        MEDIUM: {
          firstResponseMin: { type: Number, default: 240 },
          resolveMin: { type: Number, default: 720 },
        },
        HIGH: {
          firstResponseMin: { type: Number, default: 60 },
          resolveMin: { type: Number, default: 240 },
        },
        URGENT: {
          firstResponseMin: { type: Number, default: 15 },
          resolveMin: { type: Number, default: 60 },
        },
      },
      aiEnabled: { type: Boolean, default: defaultTenantSettings.aiEnabled },
      aiThreshold: { type: Number, default: defaultTenantSettings.aiThreshold, min: 0, max: 1 },
    },
  },
  {
    timestamps: true,
  },
);

export const Tenant = model<ITenantDocument>('Tenant', tenantSchema);
