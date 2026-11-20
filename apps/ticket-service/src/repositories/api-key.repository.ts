import { BaseTenantRepository } from './base.repository.js';
import { ApiKeyModel, type IApiKeyDocument } from '../models/api-key.model.js';
import { isDbConnected } from '../lib/mongoose.js';

export class ApiKeyRepository extends BaseTenantRepository<IApiKeyDocument> {
  constructor(tenantId: string) {
    super(tenantId, ApiKeyModel);
  }

  async listActive(): Promise<IApiKeyDocument[]> {
    if (!isDbConnected() && !('mock' in ApiKeyModel.find)) {
      return [];
    }
    return this.find({ revokedAt: { $exists: false } }, undefined, {
      sort: { createdAt: -1 },
    });
  }

  async revoke(id: string): Promise<IApiKeyDocument | null> {
    return this.updateById(id, { revokedAt: new Date() });
  }

  static async findByKeyHash(keyHash: string): Promise<IApiKeyDocument | null> {
    if (!isDbConnected() && !('mock' in ApiKeyModel.findOne)) {
      return null;
    }
    return ApiKeyModel.findOne({ keyHash, revokedAt: { $exists: false } }).exec();
  }
}
