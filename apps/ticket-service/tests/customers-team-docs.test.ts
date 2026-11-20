import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { Customer } from '../src/models/customer.model.js';
import { User } from '../src/models/user.model.js';

const ACCESS_SECRET = 'test-access-secret-must-be-32-chars!!';
const REFRESH_SECRET = 'test-refresh-secret-must-be-32-chars!';

configureAuth({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
  accessExpiresIn: '15m' as const,
  refreshExpiresIn: '7d' as const,
});

const tenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
const agentId = new Types.ObjectId('507f191e810c19729de860aa');

function createToken(role = 'AGENT', userId = agentId): string {
  return jwt.sign({ sub: userId.toString(), tenantId: tenantId.toString(), role }, ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

describe('Customers, Team, and INT-3 Docs Endpoints', () => {
  const app = createApp('silent');
  const agentToken = createToken('AGENT');
  const leadToken = createToken('LEAD');

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Customer.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      return Promise.resolve(this);
    });
    vi.spyOn(User.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      return Promise.resolve(this);
    });
  });

  describe('Customers API', () => {
    it('creates or upserts customer with POST /api/v1/customers', async () => {
      const customerData = {
        email: 'customer@example.com',
        name: 'Jane Customer',
        externalId: 'ext-123',
      };

      vi.spyOn(Customer, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${agentToken}`)
        .send(customerData);

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('customer@example.com');
      expect(res.body.data.name).toBe('Jane Customer');
    });

    it('lists customers with pagination with GET /api/v1/customers', async () => {
      const mockCustomer = {
        _id: new Types.ObjectId(),
        tenantId,
        email: 'customer@example.com',
        name: 'Jane Customer',
        createdAt: new Date(),
      };

      vi.spyOn(Customer, 'find').mockReturnValue({
        sort: () => ({
          limit: () => Promise.resolve([mockCustomer]),
        }),
      } as any);

      const res = await request(app)
        .get('/api/v1/customers?limit=10')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('Team API', () => {
    it('lists team members with GET /api/v1/team', async () => {
      const mockUsers = [
        {
          _id: agentId,
          email: 'agent@test.com',
          name: 'Agent Test',
          role: 'AGENT',
          status: 'ACTIVE',
          isEmailVerified: true,
          createdAt: new Date(),
        },
      ];

      vi.spyOn(User, 'find').mockResolvedValue(mockUsers as any);

      const res = await request(app)
        .get('/api/v1/team')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toBe('agent@test.com');
    });

    it('invites a new team member with POST /api/v1/team/invite (LEAD required)', async () => {
      const inviteData = {
        email: 'newagent@test.com',
        name: 'New Agent',
        role: 'AGENT',
      };

      vi.spyOn(User, 'findOne').mockResolvedValue(null);
      vi.spyOn(User, 'create').mockResolvedValue({
        _id: new Types.ObjectId(),
        tenantId,
        ...inviteData,
        status: 'INVITED',
        createdAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Authorization', `Bearer ${leadToken}`)
        .send(inviteData);

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('newagent@test.com');
      expect(res.body.data.status).toBe('INVITED');
    });

    it('rejects team invite from non-lead (AGENT)', async () => {
      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          email: 'newagent@test.com',
          name: 'New Agent',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('INT-3: OpenAPI/Swagger Documentation Endpoints', () => {
    it('serves OpenAPI 3.0 specification JSON at GET /api/v1/docs/openapi.json', async () => {
      const res = await request(app).get('/api/v1/docs/openapi.json');

      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toContain('SupportPilot');
      expect(res.body.paths).toHaveProperty('/tickets');
      expect(res.body.paths).toHaveProperty('/tickets/bulk');
      expect(res.body.paths).toHaveProperty('/customers');
      expect(res.body.paths).toHaveProperty('/team');
    });

    it('serves Swagger UI HTML page at GET /api/v1/docs', async () => {
      const res = await request(app).get('/api/v1/docs');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('swagger-ui');
    });
  });
});
