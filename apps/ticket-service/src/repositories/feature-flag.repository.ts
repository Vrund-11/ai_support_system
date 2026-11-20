import { BaseTenantRepository } from './base.repository.js';
import { FeatureFlagModel, type IFeatureFlagDocument } from '../models/feature-flag.model.js';
import { isDbConnected } from '../lib/mongoose.js';

export const DEFAULT_FEATURE_FLAGS = [
  {
    key: 'ai_copilot',
    name: 'AI Copilot & Suggestions',
    enabled: true,
    description: 'RAG-powered reply recommendations',
  },
  {
    key: 'sla_automation',
    name: 'SLA Breach Automation',
    enabled: true,
    description: 'Automated 75% warning and 100% breach timers',
  },
  {
    key: 'realtime_chat',
    name: 'Real-Time Customer Chat',
    enabled: true,
    description: 'Socket.IO bidirectional customer widget',
  },
  {
    key: 'biometrics_auth',
    name: 'Biometric Mobile Auth',
    enabled: true,
    description: 'FaceID/TouchID unlock on mobile',
  },
  {
    key: 'auto_assignment',
    name: 'Auto-Assignment Rules',
    enabled: false,
    description: 'Assign tickets round-robin to active agents',
  },
];

export class FeatureFlagRepository extends BaseTenantRepository<IFeatureFlagDocument> {
  constructor(tenantId: string) {
    super(tenantId, FeatureFlagModel);
  }

  async listFlags(): Promise<IFeatureFlagDocument[]> {
    if (!isDbConnected() && !('mock' in FeatureFlagModel.find)) {
      return DEFAULT_FEATURE_FLAGS.map((f) => ({
        ...f,
        tenantId: this.tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as any;
    }

    const existing = await this.find({});
    if (existing.length === 0) {
      // Seed default flags on first fetch
      const docs = await Promise.all(
        DEFAULT_FEATURE_FLAGS.map((f) =>
          this.create({
            tenantId: this.tenantId,
            ...f,
          } as any),
        ),
      );
      return docs;
    }
    return existing;
  }

  async setFlag(key: string, enabled: boolean): Promise<IFeatureFlagDocument | null> {
    const existing = await this.findOne({ key } as any);
    if (!existing) {
      const def = DEFAULT_FEATURE_FLAGS.find((f) => f.key === key);
      return this.create({
        tenantId: this.tenantId,
        key,
        name: def?.name ?? key,
        enabled,
        description: def?.description,
      } as any);
    }
    return this.updateOne({ key } as any, { enabled, updatedAt: new Date() });
  }
}
