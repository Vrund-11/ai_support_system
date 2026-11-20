import { BaseTenantRepository } from './base.repository.js';
import { AuditLogModel, type IAuditLogDocument } from '../models/audit-log.model.js';
import { isDbConnected } from '../lib/mongoose.js';

export class AuditLogRepository extends BaseTenantRepository<IAuditLogDocument> {
  constructor(tenantId: string) {
    super(tenantId, AuditLogModel);
  }

  async logEvent(params: {
    userId?: string;
    userEmail?: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<IAuditLogDocument> {
    return this.create({
      tenantId: this.tenantId,
      userId: params.userId as any,
      userEmail: params.userEmail,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: params.metadata ?? {},
      ipAddress: params.ipAddress,
    } as any);
  }

  async listEvents(limit: number = 50, action?: string): Promise<IAuditLogDocument[]> {
    if (!isDbConnected() && !('mock' in AuditLogModel.find)) {
      return [];
    }
    const filter: Record<string, unknown> = {};
    if (action) {
      filter['action'] = action;
    }
    return this.find(filter as any, undefined, {
      sort: { createdAt: -1 },
      limit,
    });
  }
}
