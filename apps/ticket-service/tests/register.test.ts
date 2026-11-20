import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Tenant } from '../src/models/tenant.model.js';
import { User } from '../src/models/user.model.js';
import * as tenantService from '../src/services/tenant.service.js';

describe('Auth Register (POST /api/v1/auth/register)', () => {
  const app = createApp('silent');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid payload with 400 problem details', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      tenantName: 'A', // too short
      name: 'John',
      email: 'invalid-email',
      password: '123', // too short
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      status: 400,
      type: '/errors/validation',
    });
  });

  it('slugify helper generates clean url-friendly slug', () => {
    expect(tenantService.slugify('Acme Corporation, Inc.')).toBe('acme-corporation-inc');
    expect(tenantService.slugify('  My-Company  ')).toBe('my-company');
    expect(tenantService.slugify('Tech & Design')).toBe('tech-design');
  });

  it('registers tenant and owner user successfully', async () => {
    const fakeTenantId = '507f1f77bcf86cd799439011';
    const fakeUserId = '507f191e810c19729de860ea';

    vi.spyOn(Tenant, 'findOne').mockResolvedValue(null);
    vi.spyOn(Tenant.prototype, 'save').mockImplementation(function (this: any) {
      this._id = fakeTenantId;
      this.createdAt = new Date('2026-01-01');
      return Promise.resolve(this);
    });

    vi.spyOn(User.prototype, 'save').mockImplementation(function (this: any) {
      this._id = fakeUserId;
      this.createdAt = new Date('2026-01-01');
      return Promise.resolve(this);
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      tenantName: 'Acme Corp',
      name: 'Alice Smith',
      email: 'alice@acme.com',
      password: 'supersecretpassword123',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.tenant).toMatchObject({
      name: 'Acme Corp',
      slug: 'acme-corp',
      plan: 'FREE',
    });
    expect(res.body.data.tenant.settings.sla).toBeDefined();
    expect(res.body.data.tenant.widgetKey).toHaveLength(32);

    expect(res.body.data.user).toMatchObject({
      email: 'alice@acme.com',
      name: 'Alice Smith',
      role: 'OWNER',
      status: 'ACTIVE',
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });
});
