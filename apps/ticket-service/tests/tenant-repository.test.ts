import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { AppError } from '@supportpilot/shared-lib';
import { BaseTenantRepository } from '../src/repositories/base.repository.js';
import { UserRepository } from '../src/repositories/user.repository.js';
import { User, type IUserDocument } from '../src/models/user.model.js';

describe('BaseTenantRepository (S1-T05 / TEN-1)', () => {
  const tenantAId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantBId = new Types.ObjectId('507f1f77bcf86cd799439022');
  const recordAId = new Types.ObjectId('507f191e810c19729de860aa');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor & Unscoped Query Prevention', () => {
    it('throws AppError 400 when tenantId is empty or undefined', () => {
      expect(() => new BaseTenantRepository('' as any, User as any)).toThrow(AppError);
      expect(() => new BaseTenantRepository(null as any, User as any)).toThrow(AppError);
      expect(() => new BaseTenantRepository(undefined as any, User as any)).toThrow(AppError);
    });

    it('throws AppError 400 when tenantId string has invalid hex format', () => {
      expect(() => new BaseTenantRepository('invalid-id', User as any)).toThrow(AppError);
    });

    it('accepts valid string and converts to Types.ObjectId', () => {
      const repo = new BaseTenantRepository(tenantAId.toString(), User as any);
      expect(repo.getTenantId()).toBeInstanceOf(Types.ObjectId);
      expect(repo.getTenantId().equals(tenantAId)).toBe(true);
    });

    it('accepts valid Types.ObjectId directly', () => {
      const repo = new BaseTenantRepository(tenantAId, User as any);
      expect(repo.getTenantId().equals(tenantAId)).toBe(true);
    });
  });

  describe('scopeFilter & Cross-Tenant Filter Injection Prevention', () => {
    it('injects tenantId into empty filter', () => {
      const repo = new BaseTenantRepository(tenantAId, User as any);
      const scoped = repo.scopeFilter();
      expect(scoped['tenantId']).toEqual(tenantAId);
    });

    it('preserves existing query parameters while scoping tenantId', () => {
      const repo = new BaseTenantRepository(tenantAId, User as any);
      const scoped = repo.scopeFilter({ email: 'test@example.com' });
      expect(scoped).toMatchObject({
        email: 'test@example.com',
        tenantId: tenantAId,
      });
    });

    it('allows matching tenantId in query', () => {
      const repo = new BaseTenantRepository(tenantAId, User as any);
      const scoped = repo.scopeFilter({ tenantId: tenantAId });
      expect(scoped['tenantId']).toEqual(tenantAId);
    });

    it('throws 403 AppError when query attempts cross-tenant filter injection', () => {
      const repo = new BaseTenantRepository(tenantAId, User as any);
      expect(() => repo.scopeFilter({ tenantId: tenantBId })).toThrow(AppError);
      try {
        repo.scopeFilter({ tenantId: tenantBId });
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.type).toBe('/errors/cross-tenant-violation');
      }
    });
  });

  describe('Cross-Tenant Data Isolation (T-TEN-01)', () => {
    // In-memory simulated collection enforcing tenantId filtering
    let simulatedDatabase: Array<{
      _id: Types.ObjectId;
      tenantId: Types.ObjectId;
      name: string;
      email: string;
    }> = [];

    beforeEach(() => {
      simulatedDatabase = [
        {
          _id: recordAId,
          tenantId: tenantAId,
          name: 'Tenant A Record',
          email: 'alice@tenant-a.com',
        },
      ];

      // Mock User model methods to query simulatedDatabase with exact filter received
      vi.spyOn(User, 'findOne').mockImplementation(((filter: any) => {
        const found = simulatedDatabase.find((item) => {
          if (filter._id && !item._id.equals(filter._id)) return false;
          if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
          if (filter.email && item.email !== filter.email) return false;
          return true;
        });
        return Promise.resolve(found ?? null);
      }) as any);

      vi.spyOn(User, 'find').mockImplementation(((filter: any) => {
        const items = simulatedDatabase.filter((item) => {
          if (filter && filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
          return true;
        });
        return {
          sort: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(items),
          then: (resolve: any) => resolve(items),
        } as any;
      }) as any);

      vi.spyOn(User, 'findOneAndUpdate').mockImplementation(((filter: any, update: any) => {
        const index = simulatedDatabase.findIndex((item) => {
          if (filter._id && !item._id.equals(filter._id)) return false;
          if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
          return true;
        });
        if (index === -1) return Promise.resolve(null);
        simulatedDatabase[index] = { ...simulatedDatabase[index]!, ...update };
        return Promise.resolve(simulatedDatabase[index]);
      }) as any);

      vi.spyOn(User, 'deleteOne').mockImplementation(((filter: any) => {
        const initialLen = simulatedDatabase.length;
        simulatedDatabase = simulatedDatabase.filter((item) => {
          if (filter._id && item._id.equals(filter._id) && filter.tenantId.equals(item.tenantId)) {
            return false;
          }
          return true;
        });
        const deletedCount = initialLen - simulatedDatabase.length;
        return Promise.resolve({ deletedCount, acknowledged: true } as any);
      }) as any);

      vi.spyOn(User, 'countDocuments').mockImplementation(((filter: any) => {
        const count = simulatedDatabase.filter((item) => {
          if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
          return true;
        }).length;
        return Promise.resolve(count);
      }) as any);

      vi.spyOn(User, 'exists').mockImplementation(((filter: any) => {
        const exists = simulatedDatabase.some((item) => {
          if (filter._id && !item._id.equals(filter._id)) return false;
          if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
          return true;
        });
        return Promise.resolve(exists ? { _id: recordAId } : null);
      }) as any);
    });

    it('Tenant A repo can read Tenant A record', async () => {
      const repoA = new BaseTenantRepository<IUserDocument>(tenantAId, User);
      const doc = await repoA.findById(recordAId);
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Tenant A Record');
    });

    it('Tenant B repo CANNOT read Tenant A record via findById (returns null)', async () => {
      const repoB = new BaseTenantRepository<IUserDocument>(tenantBId, User);
      const doc = await repoB.findById(recordAId);
      expect(doc).toBeNull();
    });

    it('Tenant B repo CANNOT read Tenant A record via findOne (returns null)', async () => {
      const repoB = new BaseTenantRepository<IUserDocument>(tenantBId, User);
      const doc = await repoB.findOne({ email: 'alice@tenant-a.com' });
      expect(doc).toBeNull();
    });

    it('Tenant B repo CANNOT list Tenant A records via find', async () => {
      const repoB = new BaseTenantRepository<IUserDocument>(tenantBId, User);
      const docs = await repoB.find();
      expect(docs).toHaveLength(0);
    });

    it('Tenant B repo count() does NOT count Tenant A records', async () => {
      const repoB = new BaseTenantRepository<IUserDocument>(tenantBId, User);
      const count = await repoB.count();
      expect(count).toBe(0);

      const repoA = new BaseTenantRepository<IUserDocument>(tenantAId, User);
      const countA = await repoA.count();
      expect(countA).toBe(1);
    });

    it('Tenant B repo CANNOT update Tenant A record via updateById (returns null)', async () => {
      const repoB = new BaseTenantRepository<IUserDocument>(tenantBId, User);
      const updated = await repoB.updateById(recordAId, { name: 'Hacked by Tenant B' });

      expect(updated).toBeNull();
      // Verify record A unchanged in database
      const repoA = new BaseTenantRepository<IUserDocument>(tenantAId, User);
      const docA = await repoA.findById(recordAId);
      expect(docA?.name).toBe('Tenant A Record');
    });

    it('Tenant B repo CANNOT delete Tenant A record via deleteById (returns false)', async () => {
      const repoB = new BaseTenantRepository<IUserDocument>(tenantBId, User);
      const deleted = await repoB.deleteById(recordAId);

      expect(deleted).toBe(false);
      // Verify record A still exists
      const repoA = new BaseTenantRepository<IUserDocument>(tenantAId, User);
      const docA = await repoA.findById(recordAId);
      expect(docA).not.toBeNull();
    });

    it('Tenant A repo can update Tenant A record', async () => {
      const repoA = new BaseTenantRepository<IUserDocument>(tenantAId, User);
      const updated = await repoA.updateById(recordAId, { name: 'Updated by Tenant A' });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('Updated by Tenant A');
    });

    it('Tenant A repo can delete Tenant A record', async () => {
      const repoA = new BaseTenantRepository<IUserDocument>(tenantAId, User);
      const deleted = await repoA.deleteById(recordAId);

      expect(deleted).toBe(true);
      const docA = await repoA.findById(recordAId);
      expect(docA).toBeNull();
    });
  });

  describe('create and UserRepository concrete implementation', () => {
    it('create() forcibly sets tenantId to repository scope', async () => {
      const repo = new BaseTenantRepository<IUserDocument>(tenantAId, User);

      let savedDoc: any = null;
      vi.spyOn(User.prototype, 'save').mockImplementation(function (this: any) {
        savedDoc = this;
        return Promise.resolve(this);
      });

      await repo.create({
        name: 'Bob',
        email: 'bob@example.com',
        // Attempt to spoof tenantId
        tenantId: tenantBId as any,
      });

      expect(savedDoc.tenantId.equals(tenantAId)).toBe(true);
    });

    it('UserRepository extends BaseTenantRepository and provides findByEmail scoped to tenant', async () => {
      const userRepo = new UserRepository(tenantAId);
      expect(userRepo.getTenantId().equals(tenantAId)).toBe(true);

      const findSpy = vi.spyOn(User, 'findOne').mockResolvedValue({
        _id: recordAId,
        tenantId: tenantAId,
        email: 'bob@example.com',
      } as any);

      await userRepo.findByEmail('BOB@EXAMPLE.COM');

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'bob@example.com',
          tenantId: tenantAId,
        }),
        undefined,
        undefined,
      );
    });
  });
});
