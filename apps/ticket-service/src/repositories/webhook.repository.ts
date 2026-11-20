import { BaseTenantRepository } from './base.repository.js';
import {
  WebhookSubscriptionModel,
  type IWebhookSubscriptionDocument,
} from '../models/webhook.model.js';
import { isDbConnected } from '../lib/mongoose.js';

export class WebhookRepository extends BaseTenantRepository<IWebhookSubscriptionDocument> {
  constructor(tenantId: string) {
    super(tenantId, WebhookSubscriptionModel);
  }

  async listSubscriptions(): Promise<IWebhookSubscriptionDocument[]> {
    if (!isDbConnected() && !('mock' in WebhookSubscriptionModel.find)) {
      return [];
    }
    return this.find({}, undefined, {
      sort: { createdAt: -1 },
    });
  }

  async findSubscriptionsForEvent(event: string): Promise<IWebhookSubscriptionDocument[]> {
    if (!isDbConnected() && !('mock' in WebhookSubscriptionModel.find)) {
      return [];
    }
    return this.find({ active: true, events: event });
  }
}
