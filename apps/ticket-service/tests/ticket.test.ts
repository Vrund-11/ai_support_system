import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { Ticket, type ITicketDocument } from '../src/models/ticket.model.js';
import { Counter } from '../src/models/counter.model.js';

const ACCESS_SECRET = 'test-access-secret-must-be-32-chars!!';
const REFRESH_SECRET = 'test-refresh-secret-must-be-32-chars!';

configureAuth({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
  accessExpiresIn: '15m' as const,
  refreshExpiresIn: '7d' as const,
});

const tenantAId = new Types.ObjectId('507f1f77bcf86cd799439011');
const tenantBId = new Types.ObjectId('507f1f77bcf86cd799439022');
const customerId = new Types.ObjectId('507f191e810c19729de860bb');

function createAgentToken(tenantId: Types.ObjectId): string {
  return jwt.sign(
    { sub: '507f191e810c19729de860aa', tenantId: tenantId.toString(), role: 'AGENT' },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

describe('Ticket Service & Endpoints (S1-T06: TKT-1, 3, 9)', () => {
  const app = createApp('silent');
  const tokenA = createAgentToken(tenantAId);
  const tokenB = createAgentToken(tenantBId);

  // In-memory simulated ticket collection
  let ticketsDb: Array<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    number: number;
    subject: string;
    description: string;
    status: string;
    priority: string;
    customerId: Types.ObjectId;
    tags: string[];
    customFields: Record<string, unknown>;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  let ticketCounter = 0;

  beforeEach(() => {
    vi.restoreAllMocks();
    ticketsDb = [];
    ticketCounter = 0;

    // Mock Counter atomic findOneAndUpdate
    vi.spyOn(Counter, 'findOneAndUpdate').mockImplementation(async () => {
      ticketCounter += 1;
      return { value: ticketCounter } as any;
    });

    // Mock Ticket save
    vi.spyOn(Ticket.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      this.createdAt = new Date();
      this.updatedAt = new Date();
      ticketsDb.push({
        _id: this._id,
        tenantId: this.tenantId,
        number: this.number,
        subject: this.subject,
        description: this.description,
        status: this.status,
        priority: this.priority,
        customerId: this.customerId,
        tags: this.tags ?? [],
        customFields: this.customFields ?? {},
        version: this.version ?? 1,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      });
      return Promise.resolve(this);
    });

    // Mock Ticket findOne
    vi.spyOn(Ticket, 'findOne').mockImplementation(((filter: any) => {
      const found = ticketsDb.find((item) => {
        if (filter._id && !item._id.equals(filter._id)) return false;
        if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      return Promise.resolve(found ? ({ ...found } as unknown as ITicketDocument) : null);
    }) as any);

    // Mock Ticket find
    vi.spyOn(Ticket, 'find').mockImplementation(((filter: any) => {
      let filtered = ticketsDb.filter((item) => {
        if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
        if (filter.status) {
          if (filter.status.$in && !filter.status.$in.includes(item.status)) return false;
          if (typeof filter.status === 'string' && item.status !== filter.status) return false;
        }
        if (filter.priority) {
          if (filter.priority.$in && !filter.priority.$in.includes(item.priority)) return false;
          if (typeof filter.priority === 'string' && item.priority !== filter.priority)
            return false;
        }
        return true;
      });

      return {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((limitCount: number) => {
          filtered = filtered.slice(0, limitCount);
          return Promise.resolve(filtered);
        }),
      } as any;
    }) as any);

    // Mock Ticket findOneAndUpdate for optimistic concurrency
    vi.spyOn(Ticket, 'findOneAndUpdate').mockImplementation(((filter: any, update: any) => {
      const index = ticketsDb.findIndex((item) => {
        if (filter._id && !item._id.equals(filter._id)) return false;
        if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
        if (filter.version !== undefined && item.version !== filter.version) return false;
        return true;
      });

      if (index === -1) {
        return Promise.resolve(null);
      }

      const item = ticketsDb[index]!;
      if (update.$set) {
        Object.assign(item, update.$set);
      }
      if (update.$inc?.version) {
        item.version += update.$inc.version;
      }
      item.updatedAt = new Date();
      return Promise.resolve({ ...item } as unknown as ITicketDocument);
    }) as any);
  });

  describe('POST /api/v1/tickets (Create Ticket - TKT-1, 3)', () => {
    it('rejects invalid payload with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'No', // too short (<3)
          description: 'hi', // too short (<5)
        });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('/errors/validation');
    });

    it('creates ticket with auto-incremented number and initial version 1', async () => {
      const res1 = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Issue with billing checkout',
          description: 'Payment keeps failing on step 3 with error 502',
          customerId: customerId.toString(),
          priority: 'HIGH',
          tags: ['billing', 'checkout'],
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.number).toBe(1);
      expect(res1.body.data.version).toBe(1);
      expect(res1.body.data.status).toBe('NEW');
      expect(res1.body.data.priority).toBe('HIGH');
      expect(res1.body.data.tags).toEqual(['billing', 'checkout']);

      // Create second ticket — counter increments to 2
      const res2 = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Cannot reset my password',
          description: 'Reset email is never received in inbox or spam',
          customerId: customerId.toString(),
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.number).toBe(2);
      expect(res2.body.data.priority).toBe('MEDIUM'); // default priority
    });
  });

  describe('GET /api/v1/tickets (List Tickets)', () => {
    beforeEach(async () => {
      // Seed 2 tickets for Tenant A
      await request(app).post('/api/v1/tickets').set('Authorization', `Bearer ${tokenA}`).send({
        subject: 'Urgent server down',
        description: 'Main production server is down',
        customerId: customerId.toString(),
        priority: 'URGENT',
      });

      await request(app).post('/api/v1/tickets').set('Authorization', `Bearer ${tokenA}`).send({
        subject: 'Low priority question',
        description: 'Just asking about documentation format',
        customerId: customerId.toString(),
        priority: 'LOW',
      });
    });

    it('lists all tickets for authenticated tenant', async () => {
      const res = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toBeDefined();
    });

    it('filters tickets by priority', async () => {
      const res = await request(app)
        .get('/api/v1/tickets?priority=URGENT')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].priority).toBe('URGENT');
    });

    it('Tenant B sees 0 tickets (tenant isolation)', async () => {
      const res = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/tickets/:id (Get Ticket Details)', () => {
    it('returns ticket details for valid ID within tenant', async () => {
      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Detail check ticket',
          description: 'Detailed description of ticket contents',
          customerId: customerId.toString(),
        });

      const ticketId = createRes.body.data._id;

      const res = await request(app)
        .get(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.subject).toBe('Detail check ticket');
    });

    it('returns 404 when ticket belongs to different tenant', async () => {
      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Tenant A private ticket',
          description: 'Secret ticket data',
          customerId: customerId.toString(),
        });

      const ticketId = createRes.body.data._id;

      // Tenant B tries to get Tenant A's ticket
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.type).toBe('/errors/not-found');
    });
  });

  describe('PATCH /api/v1/tickets/:id (Optimistic Concurrency - TKT-9 / T-TKT-02)', () => {
    it('updates ticket and increments version when version matches', async () => {
      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Ticket for updating',
          description: 'Initial description',
          customerId: customerId.toString(),
        });

      const ticketId = createRes.body.data._id;
      expect(createRes.body.data.version).toBe(1);

      // Patch with version 1
      const patchRes = await request(app)
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          version: 1,
          status: 'OPEN',
          priority: 'HIGH',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe('OPEN');
      expect(patchRes.body.data.priority).toBe('HIGH');
      expect(patchRes.body.data.version).toBe(2); // Incremented!
    });

    it('rejects update with 409 Conflict when version is stale (concurrent modification)', async () => {
      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Concurrent edit ticket',
          description: 'Will be edited by two agents',
          customerId: customerId.toString(),
        });

      const ticketId = createRes.body.data._id;

      // Agent 1 updates with version 1 -> succeeds, version becomes 2
      const res1 = await request(app)
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          version: 1,
          status: 'OPEN',
        });
      expect(res1.status).toBe(200);
      expect(res1.body.data.version).toBe(2);

      // Agent 2 also tries to update with stale version 1 -> rejects with 409 Conflict
      const res2 = await request(app)
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          version: 1,
          priority: 'URGENT',
        });

      expect(res2.status).toBe(409);
      expect(res2.body.type).toBe('/errors/version-conflict');
    });

    it('returns 404 when Tenant B tries to update Tenant A ticket', async () => {
      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Tenant A ticket',
          description: 'Not for Tenant B to touch',
          customerId: customerId.toString(),
        });

      const ticketId = createRes.body.data._id;

      const patchRes = await request(app)
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          version: 1,
          status: 'OPEN',
        });

      expect(patchRes.status).toBe(404);
    });
  });
});
