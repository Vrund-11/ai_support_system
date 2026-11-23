import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AppError } from '@supportpilot/shared-lib';
import type { RegisterTenantInput } from '@supportpilot/validators';
import { Tenant, type ITenantDocument } from '../models/tenant.model.js';
import { User } from '../models/user.model.js';
import { generateTokens, type TokenPair } from './auth.service.js';

export interface RegisterTenantResult {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    widgetKey: string;
    settings: ITenantDocument['settings'];
    createdAt: Date;
  };
  user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: string;
    status: string;
    createdAt: Date;
  };
  tokens?: TokenPair;
  accessToken?: string;
  refreshToken?: string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function registerTenant(input: RegisterTenantInput): Promise<RegisterTenantResult> {
  let baseSlug = slugify(input.tenantName);
  if (!baseSlug) {
    baseSlug = 'tenant';
  }

  // Check if slug exists; if so, append random suffix
  let slug = baseSlug;
  const existingTenant = await Tenant.findOne({ slug });
  if (existingTenant) {
    slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
  }

  // Check if user email already exists globally or within this prospective tenant
  // An email cannot be registered multiple times for the same tenant
  const widgetKey = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(input.password, 12);

  const tenant = new Tenant({
    name: input.tenantName,
    slug,
    widgetKey,
  });

  try {
    await tenant.save();
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new AppError(
        409,
        'Tenant with this name or slug already exists',
        '/errors/duplicate-tenant',
      );
    }
    throw err;
  }

  const user = new User({
    tenantId: tenant._id,
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  try {
    await user.save();
  } catch (err: unknown) {
    // Cleanup created tenant if user creation fails
    await Tenant.deleteOne({ _id: tenant._id });

    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new AppError(409, 'User with this email already exists', '/errors/duplicate-user');
    }
    throw err;
  }

  const tokens = await generateTokens(user);

  return {
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      widgetKey: tenant.widgetKey,
      settings: tenant.settings,
      createdAt: tenant.createdAt,
    },
    user: {
      id: user._id.toString(),
      tenantId: user.tenantId.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
    tokens,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}
