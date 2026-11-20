import { BaseTenantRepository } from './base.repository.js';
import { RuleModel, type IRuleDocument } from '../models/rule.model.js';
import type { RuleTriggerEvent } from '@supportpilot/shared-types';
import { isDbConnected } from '../lib/mongoose.js';

export class RuleRepository extends BaseTenantRepository<IRuleDocument> {
  constructor(tenantId: string) {
    super(tenantId, RuleModel);
  }

  async findActiveRules(event: RuleTriggerEvent): Promise<IRuleDocument[]> {
    if (!isDbConnected() && !('mock' in RuleModel.find)) {
      return [];
    }

    return this.find(
      {
        event,
        enabled: true,
      },
      undefined,
      {
        sort: { order: 1, createdAt: 1 },
      },
    );
  }

  async listAllRules(): Promise<IRuleDocument[]> {
    if (!isDbConnected() && !('mock' in RuleModel.find)) {
      return [];
    }

    return this.find({}, undefined, {
      sort: { order: 1, createdAt: 1 },
    });
  }
}
