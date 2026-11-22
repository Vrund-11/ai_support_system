import {
  Types,
  type Model,
  type QueryFilter,
  type UpdateQuery,
  type QueryOptions,
  type ProjectionType,
  type Document,
} from 'mongoose';
import { AppError } from '@supportpilot/shared-lib';

export interface ITenantScoped {
  tenantId: Types.ObjectId;
}

export type TenantQueryFilter<T> = QueryFilter<T> & Record<string, unknown>;

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  sort?: Record<string, 1 | -1>;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

/**
 * Base repository enforcing strict tenant isolation at the data-access layer.
 * Injects tenantId into all queries, mutations, and insertions.
 * Forbids unscoped operations and cross-tenant query injection.
 */
export class BaseTenantRepository<T extends Document & ITenantScoped> {
  protected readonly tenantId: Types.ObjectId;
  protected readonly model: Model<T>;

  constructor(tenantId: string | Types.ObjectId, model: Model<T>) {
    if (!tenantId) {
      throw new AppError(
        400,
        'Tenant context required: unscoped queries are strictly forbidden',
        '/errors/unscoped-query',
      );
    }

    if (typeof tenantId === 'string') {
      if (!Types.ObjectId.isValid(tenantId)) {
        throw new AppError(
          400,
          `Invalid tenantId format: ${tenantId}`,
          '/errors/invalid-tenant-id',
        );
      }
      this.tenantId = new Types.ObjectId(tenantId);
    } else {
      this.tenantId = tenantId;
    }

    this.model = model;
  }

  /** Current tenant ID */
  getTenantId(): Types.ObjectId {
    return this.tenantId;
  }

  /**
   * Scopes any filter by injecting { tenantId }.
   * Throws an error if a different tenantId is already specified in filter.
   */
  scopeFilter(filter: TenantQueryFilter<T> = {} as TenantQueryFilter<T>): TenantQueryFilter<T> {
    if (filter['tenantId'] !== undefined) {
      const filterTenantStr = filter['tenantId']?.toString();
      if (filterTenantStr && filterTenantStr !== this.tenantId.toString()) {
        throw new AppError(
          403,
          'Cross-tenant access violation: filter tenantId does not match repository scope',
          '/errors/cross-tenant-violation',
        );
      }
    }

    return {
      ...filter,
      tenantId: this.tenantId,
    };
  }

  /** Find by document ID within current tenant scope */
  async findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    if (typeof id === 'string' && !Types.ObjectId.isValid(id)) {
      return null;
    }
    const objectId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    return this.model.findOne(
      this.scopeFilter({ _id: objectId } as TenantQueryFilter<T>),
      projection,
      options,
    );
  }

  /** Find one document matching query within current tenant scope */
  async findOne(
    filter: TenantQueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    return this.model.findOne(this.scopeFilter(filter), projection, options);
  }

  /** Find all documents matching query within current tenant scope */
  async find(
    filter: TenantQueryFilter<T> = {} as TenantQueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    return this.model.find(this.scopeFilter(filter), projection, options);
  }

  /** Paginated query with cursor support (keyset on updatedAt, _id or _id fallback) */
  async findWithPagination(
    filter: TenantQueryFilter<T> = {} as TenantQueryFilter<T>,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<T>> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const queryFilter: TenantQueryFilter<T> = { ...filter };

    let cursorUpdatedAt: Date | null = null;
    let cursorId: Types.ObjectId | null = null;

    if (options.cursor) {
      try {
        const decoded = Buffer.from(options.cursor, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (parsed.updatedAt && parsed._id) {
          const date = new Date(parsed.updatedAt);
          if (!isNaN(date.getTime()) && Types.ObjectId.isValid(parsed._id)) {
            cursorUpdatedAt = date;
            cursorId = new Types.ObjectId(parsed._id);
          }
        }
      } catch {
        if (Types.ObjectId.isValid(options.cursor)) {
          cursorId = new Types.ObjectId(options.cursor);
        }
      }

      if (cursorUpdatedAt && cursorId) {
        queryFilter['$or'] = [
          { updatedAt: { $lt: cursorUpdatedAt } },
          { updatedAt: cursorUpdatedAt, _id: { $lt: cursorId } },
        ] as any;
      } else if (cursorId) {
        queryFilter['_id'] = { $lt: cursorId };
      }
    }

    const sort = options.sort ?? { updatedAt: -1, _id: -1 };
    const query = this.model.find(this.scopeFilter(queryFilter)).sort(sort);

    const limitedQuery = query.limit(limit + 1);
    const items =
      typeof (limitedQuery as any).lean === 'function'
        ? await (limitedQuery as any).lean()
        : await limitedQuery;

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    let nextCursor: string | undefined = undefined;

    if (hasMore && resultItems.length > 0) {
      const last = resultItems[resultItems.length - 1];
      if (last.updatedAt && last._id) {
        nextCursor = Buffer.from(
          JSON.stringify({
            updatedAt: new Date(last.updatedAt).toISOString(),
            _id: last._id.toString(),
          }),
        ).toString('base64');
      } else if (last._id) {
        nextCursor = last._id.toString();
      }
    }

    return {
      items: resultItems,
      nextCursor,
    };
  }

  /** Create a new document in this tenant */
  async create(doc: Partial<T>): Promise<T> {
    const entity = new this.model({
      ...doc,
      tenantId: this.tenantId,
    });
    return (await entity.save()) as T;
  }

  /** Update a document by ID within current tenant scope */
  async updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    if (typeof id === 'string' && !Types.ObjectId.isValid(id)) {
      return null;
    }
    const objectId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    return this.model.findOneAndUpdate(
      this.scopeFilter({ _id: objectId } as TenantQueryFilter<T>),
      update,
      { new: true, ...options },
    );
  }

  /** Update one document within current tenant scope */
  async updateOne(
    filter: TenantQueryFilter<T>,
    update: UpdateQuery<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(this.scopeFilter(filter), update, {
      new: true,
      ...options,
    });
  }

  /** Delete a document by ID within current tenant scope */
  async deleteById(id: string | Types.ObjectId): Promise<boolean> {
    if (typeof id === 'string' && !Types.ObjectId.isValid(id)) {
      return false;
    }
    const objectId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    const result = await this.model.deleteOne(
      this.scopeFilter({ _id: objectId } as TenantQueryFilter<T>),
    );
    return (result.deletedCount ?? 0) > 0;
  }

  /** Delete one document within current tenant scope */
  async deleteOne(filter: TenantQueryFilter<T>): Promise<boolean> {
    const result = await this.model.deleteOne(this.scopeFilter(filter));
    return (result.deletedCount ?? 0) > 0;
  }

  /** Count documents within current tenant scope */
  async count(filter: TenantQueryFilter<T> = {} as TenantQueryFilter<T>): Promise<number> {
    return this.model.countDocuments(this.scopeFilter(filter));
  }

  /** Check if document exists within current tenant scope */
  async exists(filter: TenantQueryFilter<T>): Promise<boolean> {
    const doc = await this.model.exists(this.scopeFilter(filter));
    return Boolean(doc);
  }
}
