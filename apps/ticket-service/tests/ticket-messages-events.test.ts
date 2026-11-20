import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { Ticket, type ITicketDocument } from '../src/models/ticket.model.js';
import { Counter } from '../src/models/counter.model.js';
import { Message, type IMessageDocument } from '../src/models/message.model.js';
import { TicketEvent, type ITicketEventDocument } from '../src/models/ticket-event.model.js';

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
const agentAId = new Types.ObjectId('507f191e810c19729de860aa');
const customerId = new Types.ObjectId('507f191e810c19729de860bb');

function createAgentToken(tenantId: Types.ObjectId, agentId: Types.ObjectId = agentAId): string {
  return jwt.sign(
    { sub: agentId.toString(), tenantId: tenantId.toString(), role: 'AGENT' },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

describe('Ticket Messages & Activity Timeline (S1-T08: TKT-5, 10)', () => {
  const app = createApp('silent');
  const tokenA = createAgentToken(tenantAId);
  const tokenB = createAgentToken(tenantBId);

  // In-memory simulated collections
  let ticketsDb: Array<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    number: number;
    subject: string;
    description: string;
    status: string;
    priority: string;
    assigneeId?: Types.ObjectId;
    customerId: Types.ObjectId;
    tags: string[];
    version: number;
  }> = [];

  let messagesDb: Array<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    ticketId: Types.ObjectId;
    seq: number;
    senderType: string;
    senderId?: Types.ObjectId;
    body: string;
    isInternal: boolean;
    attachments: any[];
  }> = [];

  let eventsDb: Array<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    ticketId: Types.ObjectId;
    actorId?: Types.ObjectId;
    type: string;
    from?: string;
    to?: string;
    at: Date;
  }> = [];

  let ticketCounter = 0;
  let msgSeqCounter = 0;

  beforeEach(() => {
    vi.restoreAllMocks();
    ticketsDb = [];
    messagesDb = [];
    eventsDb = [];
    ticketCounter = 0;
    msgSeqCounter = 0;

    // Counter mock
    vi.spyOn(Counter, 'findOneAndUpdate').mockImplementation(async (filter: any) => {
      if (filter.key === 'ticket_number') {
        ticketCounter += 1;
        return { value: ticketCounter } as any;
      }
      if (filter.key?.startsWith('ticket_msg_seq:')) {
        msgSeqCounter += 1;
        return { value: msgSeqCounter } as any;
      }
      return { value: 1 } as any;
    });

    // Ticket save mock
    vi.spyOn(Ticket.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      ticketsDb.push({
        _id: this._id,
        tenantId: this.tenantId,
        number: this.number,
        subject: this.subject,
        description: this.description,
        status: this.status,
        priority: this.priority,
        assigneeId: this.assigneeId,
        customerId: this.customerId,
        tags: this.tags ?? [],
        version: this.version ?? 1,
      });
      return Promise.resolve(this);
    });

    // Ticket findOne mock
    vi.spyOn(Ticket, 'findOne').mockImplementation(((filter: any) => {
      const found = ticketsDb.find((item) => {
        if (filter._id && !item._id.equals(filter._id)) return false;
        if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      return Promise.resolve(found ? ({ ...found } as unknown as ITicketDocument) : null);
    }) as any);

    // Ticket findOneAndUpdate mock
    vi.spyOn(Ticket, 'findOneAndUpdate').mockImplementation(((filter: any, update: any) => {
      const index = ticketsDb.findIndex((item) => {
        if (filter._id && !item._id.equals(filter._id)) return false;
        if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
        if (filter.version !== undefined && item.version !== filter.version) return false;
        return true;
      });
      if (index === -1) return Promise.resolve(null);
      const item = ticketsDb[index]!;
      if (update.$set) Object.assign(item, update.$set);
      if (update.$inc?.version) item.version += update.$inc.version;
      return Promise.resolve({ ...item } as unknown as ITicketDocument);
    }) as any);

    // Message save mock
    vi.spyOn(Message.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      messagesDb.push({
        _id: this._id,
        tenantId: this.tenantId,
        ticketId: this.ticketId,
        seq: this.seq,
        senderType: this.senderType,
        senderId: this.senderId,
        body: this.body,
        isInternal: this.isInternal,
        attachments: this.attachments ?? [],
      });
      return Promise.resolve(this);
    });

    // Message find mock
    vi.spyOn(Message, 'find').mockImplementation(((filter: any) => {
      const filtered = messagesDb.filter((item) => {
        if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
        if (filter.ticketId && !item.ticketId.equals(filter.ticketId)) return false;
        if (filter.isInternal !== undefined && item.isInternal !== filter.isInternal) return false;
        return true;
      });
      return {
        sort: vi.fn().mockReturnValue(filtered as unknown as IMessageDocument[]),
      } as any;
    }) as any);

    // TicketEvent save mock
    vi.spyOn(TicketEvent.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) this._id = new Types.ObjectId();
      eventsDb.push({
        _id: this._id,
        tenantId: this.tenantId,
        ticketId: this.ticketId,
        actorId: this.actorId,
        type: this.type,
        from: this.from,
        to: this.to,
        at: this.at ?? new Date(),
      });
      return Promise.resolve(this);
    });

    // TicketEvent find mock
    vi.spyOn(TicketEvent, 'find').mockImplementation(((filter: any) => {
      const filtered = eventsDb.filter((item) => {
        if (filter.tenantId && !item.tenantId.equals(filter.tenantId)) return false;
        if (filter.ticketId && !item.ticketId.equals(filter.ticketId)) return false;
        return true;
      });
      return {
        sort: vi.fn().mockReturnValue(filtered as unknown as ITicketEventDocument[]),
      } as any;
    }) as any);
  });

  describe('POST /api/v1/tickets/:id/messages (TKT-5)', () => {
    let ticketId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Thread test ticket',
          description: 'Initial customer inquiry',
          customerId: customerId.toString(),
        });
      ticketId = res.body.data._id;
    });

    it('adds public reply and records MESSAGE event on timeline', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          body: 'Hello, we are looking into your issue now.',
          isInternal: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.seq).toBe(1);
      expect(res.body.data.isInternal).toBe(false);
      expect(res.body.data.senderType).toBe('AGENT');
      expect(res.body.data.body).toBe('Hello, we are looking into your issue now.');

      // Check event recorded
      expect(eventsDb).toHaveLength(1);
      expect(eventsDb[0]?.type).toBe('MESSAGE');
      expect(eventsDb[0]?.actorId?.equals(agentAId)).toBe(true);
    });

    it('adds internal note and records NOTE event on timeline', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          body: 'Customer seems confused about 2FA setup. Escalate to tier 2 if needed.',
          isInternal: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.isInternal).toBe(true);

      // Check event recorded
      expect(eventsDb).toHaveLength(1);
      expect(eventsDb[0]?.type).toBe('NOTE');
    });

    it('rejects empty message body with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          body: '   ',
        });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('/errors/validation');
    });

    it('returns 404 when ticket does not exist', async () => {
      const nonExistent = new Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/v1/tickets/${nonExistent}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          body: 'Test reply',
        });

      expect(res.status).toBe(404);
    });

    it('Tenant B cannot add message to Tenant A ticket (returns 404)', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          body: 'Tenant B intruder message',
        });

      expect(res.status).toBe(404);
      expect(messagesDb).toHaveLength(0);
    });
  });

  describe('PATCH /api/v1/tickets/:id Event Tracking (TKT-10 / T-TKT-01)', () => {
    let ticketId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Activity timeline test ticket',
          description: 'Testing event logging on update',
          customerId: customerId.toString(),
          priority: 'MEDIUM',
        });
      ticketId = res.body.data._id;
    });

    it('records STATUS, PRIORITY, and TAG events on update', async () => {
      const patchRes = await request(app)
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          version: 1,
          status: 'OPEN',
          priority: 'URGENT',
          tags: ['escalated', 'vip'],
        });

      expect(patchRes.status).toBe(200);

      // Verify events recorded in timeline
      const statusEvent = eventsDb.find((e) => e.type === 'STATUS');
      expect(statusEvent).toBeDefined();
      expect(statusEvent?.from).toBe('NEW');
      expect(statusEvent?.to).toBe('OPEN');

      const priorityEvent = eventsDb.find((e) => e.type === 'PRIORITY');
      expect(priorityEvent).toBeDefined();
      expect(priorityEvent?.from).toBe('MEDIUM');
      expect(priorityEvent?.to).toBe('URGENT');

      const tagEvent = eventsDb.find((e) => e.type === 'TAG');
      expect(tagEvent).toBeDefined();
      expect(tagEvent?.to).toBe('escalated, vip');
    });

    it('records ASSIGN event when ticket is assigned to an agent', async () => {
      const newAgentId = new Types.ObjectId();
      const patchRes = await request(app)
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          version: 1,
          assigneeId: newAgentId.toString(),
        });

      expect(patchRes.status).toBe(200);

      const assignEvent = eventsDb.find((e) => e.type === 'ASSIGN');
      expect(assignEvent).toBeDefined();
      expect(assignEvent?.from).toBe('unassigned');
      expect(assignEvent?.to).toBe(newAgentId.toString());
    });
  });

  describe('GET /api/v1/tickets/:id Details with Events & Messages', () => {
    it('returns ticket with full events timeline and message thread', async () => {
      // Create ticket
      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          subject: 'Full inspection ticket',
          description: 'Everything included',
          customerId: customerId.toString(),
        });

      const ticketId = createRes.body.data._id;

      // Add a reply
      await request(app)
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ body: 'Public reply 1' });

      // Update status
      await request(app)
        .patch(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ version: 1, status: 'OPEN' });

      // Fetch ticket details
      const detailRes = await request(app)
        .get(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.subject).toBe('Full inspection ticket');
      expect(detailRes.body.data.messages).toHaveLength(1);
      expect(detailRes.body.data.messages[0].body).toBe('Public reply 1');
      expect(detailRes.body.data.events).toHaveLength(2); // 1 MESSAGE event + 1 STATUS event
    });
  });
});
