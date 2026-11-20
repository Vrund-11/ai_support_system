import { BaseTenantRepository } from './base.repository.js';
import { User, type IUserDocument } from '../models/user.model.js';
import type { Types } from 'mongoose';

export class UserRepository extends BaseTenantRepository<IUserDocument> {
  constructor(tenantId: string | Types.ObjectId) {
    super(tenantId, User);
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    return this.findOne({ email: email.toLowerCase() });
  }
}
