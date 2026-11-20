import type { Types } from 'mongoose';
import type { CustomerFilterInput, CreateCustomerInput } from '@supportpilot/validators';
import {
  BaseTenantRepository,
  type PaginatedResult,
  type TenantQueryFilter,
} from './base.repository.js';
import { Customer, type ICustomerDocument } from '../models/customer.model.js';

export class CustomerRepository extends BaseTenantRepository<ICustomerDocument> {
  constructor(tenantId: string | Types.ObjectId) {
    super(tenantId, Customer);
  }

  async listCustomers(filter: CustomerFilterInput): Promise<PaginatedResult<ICustomerDocument>> {
    const query: TenantQueryFilter<ICustomerDocument> = {} as TenantQueryFilter<ICustomerDocument>;

    if (filter.q) {
      const regex = new RegExp(filter.q, 'i');
      query['$or'] = [{ name: regex }, { email: regex }];
    }

    return this.findWithPagination(query, {
      limit: filter.limit,
      cursor: filter.cursor,
      sort: { createdAt: -1 },
    });
  }

  async findByEmail(email: string): Promise<ICustomerDocument | null> {
    return this.findOne({
      email: email.toLowerCase().trim(),
    } as TenantQueryFilter<ICustomerDocument>);
  }

  async createOrUpdate(input: CreateCustomerInput): Promise<ICustomerDocument> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.findByEmail(email);

    if (existing) {
      existing.name = input.name;
      if (input.externalId) existing.externalId = input.externalId;
      if (input.visitorIds && input.visitorIds.length > 0) {
        existing.visitorIds = Array.from(new Set([...existing.visitorIds, ...input.visitorIds]));
      }
      existing.lastSeenAt = new Date();
      return existing.save();
    }

    return this.create({
      email,
      name: input.name,
      externalId: input.externalId,
      visitorIds: input.visitorIds ?? [],
      lastSeenAt: new Date(),
    } as unknown as Partial<ICustomerDocument>);
  }
}
