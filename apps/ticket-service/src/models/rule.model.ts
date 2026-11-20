import { Schema, model, type Document, type Types } from 'mongoose';
import type { RuleCondition, RuleAction, RuleTriggerEvent } from '@supportpilot/shared-types';

export interface IRuleDocument extends Document {
  tenantId: Types.ObjectId;
  name: string;
  description?: string;
  event: RuleTriggerEvent;
  conditions: RuleCondition[];
  conditionLogic: 'AND' | 'OR';
  actions: RuleAction[];
  enabled: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const ruleConditionSchema = new Schema<RuleCondition>(
  {
    field: {
      type: String,
      enum: ['status', 'priority', 'tag', 'keyword', 'channel'],
      required: true,
    },
    operator: {
      type: String,
      enum: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IN', 'MATCHES_REGEX'],
      required: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false },
);

const ruleActionSchema = new Schema<RuleAction>(
  {
    type: {
      type: String,
      enum: ['ASSIGN', 'ADD_TAG', 'REMOVE_TAG', 'SET_PRIORITY', 'SET_STATUS', 'NOTIFY', 'ESCALATE'],
      required: true,
    },
    target: { type: String },
    params: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const ruleSchema = new Schema<IRuleDocument>(
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
    },
    description: {
      type: String,
      trim: true,
    },
    event: {
      type: String,
      enum: ['TICKET_CREATED', 'TICKET_UPDATED', 'MESSAGE_RECEIVED'],
      default: 'TICKET_CREATED',
      index: true,
    },
    conditions: {
      type: [ruleConditionSchema],
      default: [],
    },
    conditionLogic: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND',
    },
    actions: {
      type: [ruleActionSchema],
      default: [],
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 10,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

ruleSchema.index({ tenantId: 1, event: 1, enabled: 1, order: 1 });

export const RuleModel = model<IRuleDocument>('Rule', ruleSchema);
