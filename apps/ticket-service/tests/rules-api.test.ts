import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { RuleModel } from '../src/models/rule.model.js';
import { Ticket } from '../src/models/ticket.model.js';
import { Counter } from '../src/models/counter.model.js';
import { TicketEvent } from '../src/models/ticket-event.model.js';

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

function createToken(tenantId: Types.ObjectId, role: 'AGENT' | 'LEAD' | 'OWNER'): string {
  return jwt.sign(
    { sub: '507f191e810c19729de860aa', tenantId: tenantId.toString(), role },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

describe('Rules Engine REST API & Ticket Automation (AUTO-3)', () => {
  const app = createApp('silent');
  const agentTokenA = createToken(tenantAId, 'AGENT');
  const leadTokenA = createToken(tenantAId, 'LEAD');
  const leadTokenB = createToken(tenantBId, 'LEAD');

  let rulesDb: any[] = [];
  let ticketsDb: any[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    rulesDb = [];
    ticketsDb = [];

    // Mock TicketEvent save and create to avoid live DB calls
    vi.spyOn(TicketEvent.prototype, 'save').mockResolvedValue({} as never);
    vi.spyOn(TicketEvent, 'create').mockResolvedValue({} as never);
    vi.spyOn(TicketEvent, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([]) } as never);

    // Mock RuleModel.prototype.save for BaseTenantRepository.create
    vi.spyOn(RuleModel.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      this.createdAt = new Date();
      this.updatedAt = new Date();
      rulesDb.push(this);
      return Promise.resolve(this);
    });

    // Mock RuleModel queries
    vi.spyOn(RuleModel, 'find').mockImplementation((filter: unknown) => {
      const f = filter as { tenantId?: unknown; event?: string; enabled?: boolean };
      let matches = rulesDb.filter(
        (r) => !f.tenantId || r.tenantId?.toString() === f.tenantId?.toString(),
      );
      if (f.event) matches = matches.filter((r) => r.event === f.event);
      if (f.enabled !== undefined) matches = matches.filter((r) => r.enabled === f.enabled);

      const promise = Promise.resolve(matches);
      (promise as any).sort = () => Promise.resolve(matches);
      return promise as never;
    });

    vi.spyOn(RuleModel, 'findOne').mockImplementation((filter: unknown) => {
      const f = filter as { _id?: unknown; tenantId?: unknown };
      const found = rulesDb.find(
        (r) =>
          (!f._id || r._id.toString() === f._id.toString()) &&
          (!f.tenantId || r.tenantId.toString() === f.tenantId.toString()),
      );
      return Promise.resolve(found as never);
    });

    vi.spyOn(RuleModel, 'findOneAndUpdate').mockImplementation(
      (filter: unknown, update: unknown) => {
        const f = filter as { _id?: unknown; tenantId?: unknown };
        const u = (update as { $set?: Record<string, unknown> }).$set || update;
        const found = rulesDb.find(
          (r) =>
            (!f._id || r._id.toString() === f._id.toString()) &&
            (!f.tenantId || r.tenantId.toString() === f.tenantId.toString()),
        );
        if (found) {
          Object.assign(found, u);
        }
        return Promise.resolve(found as never);
      },
    );

    vi.spyOn(RuleModel, 'findOneAndDelete').mockImplementation((filter: unknown) => {
      const f = filter as { _id?: unknown; tenantId?: unknown };
      const idx = rulesDb.findIndex(
        (r) =>
          (!f._id || r._id.toString() === f._id.toString()) &&
          (!f.tenantId || r.tenantId.toString() === f.tenantId.toString()),
      );
      if (idx !== -1) {
        const removed = rulesDb.splice(idx, 1)[0];
        return Promise.resolve(removed as never);
      }
      return Promise.resolve(null as never);
    });

    // Mock Counter atomic findOneAndUpdate
    vi.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({ value: 1001 } as never);

    // Mock Ticket.prototype.save for TicketRepository.createTicket
    vi.spyOn(Ticket.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      this.number = 1001;
      this.version = 1;
      this.createdAt = new Date();
      this.updatedAt = new Date();
      ticketsDb.push(this);
      return Promise.resolve(this);
    });

    vi.spyOn(Ticket, 'findOneAndUpdate').mockImplementation((filter: unknown, update: unknown) => {
      const f = filter as { _id?: unknown };
      const u = (update as { $set?: Record<string, unknown> }).$set || update;
      const found = ticketsDb.find((t) => !f._id || t._id.toString() === f._id.toString());
      if (found) {
        Object.assign(found, u);
      }
      return Promise.resolve(found as never);
    });
  });

  it('allows LEAD to create a new automation rule, while AGENT is forbidden', async () => {
    // AGENT cannot create rules -> 403
    const agentRes = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${agentTokenA}`)
      .send({
        name: 'Auto-assign VIP',
        conditions: [{ field: 'tag', operator: 'CONTAINS', value: 'vip' }],
        actions: [{ type: 'ASSIGN', target: 'agent_sarah' }],
      });
    expect(agentRes.status).toBe(403);

    // LEAD creates rule -> 201
    const leadRes = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${leadTokenA}`)
      .send({
        name: 'Auto-assign VIP',
        event: 'TICKET_CREATED',
        conditions: [{ field: 'tag', operator: 'CONTAINS', value: 'vip' }],
        actions: [
          { type: 'ASSIGN', target: 'agent_sarah' },
          { type: 'SET_PRIORITY', target: 'URGENT' },
        ],
        order: 1,
      });

    expect(leadRes.status).toBe(201);
    expect(leadRes.body.name).toBe('Auto-assign VIP');
    expect(leadRes.body.order).toBe(1);
  });

  it('enforces strict cross-tenant isolation on rule listing and retrieval (TEN-1)', async () => {
    // 1. Create rule under Tenant A
    const ruleRes = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${leadTokenA}`)
      .send({
        name: 'Tenant A Billing Rule',
        conditions: [{ field: 'keyword', operator: 'CONTAINS', value: 'billing' }],
        actions: [{ type: 'ADD_TAG', target: 'finance' }],
      });
    const ruleId = ruleRes.body._id;

    // 2. Tenant A lists rules -> sees 1 rule
    const listARes = await request(app)
      .get('/api/v1/rules')
      .set('Authorization', `Bearer ${agentTokenA}`);
    expect(listARes.status).toBe(200);
    expect(listARes.body.rules.length).toBe(1);

    // 3. Tenant B lists rules -> sees 0 rules
    const listBRes = await request(app)
      .get('/api/v1/rules')
      .set('Authorization', `Bearer ${leadTokenB}`);
    expect(listBRes.status).toBe(200);
    expect(listBRes.body.rules.length).toBe(0);

    // 4. Tenant B tries to fetch Tenant A rule by ID -> 404
    const getBRes = await request(app)
      .get(`/api/v1/rules/${ruleId}`)
      .set('Authorization', `Bearer ${leadTokenB}`);
    expect(getBRes.status).toBe(404);
  });

  it('automatically triggers matching rules on ticket creation to assign agent and bump priority', async () => {
    const targetAgentId = new Types.ObjectId().toString();

    // 1. Create an active rule for Tenant A
    await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${leadTokenA}`)
      .send({
        name: 'Security breach escalation',
        event: 'TICKET_CREATED',
        conditions: [{ field: 'keyword', operator: 'CONTAINS', value: 'security vulnerability' }],
        actions: [
          { type: 'ASSIGN', target: targetAgentId },
          { type: 'SET_PRIORITY', target: 'URGENT' },
          { type: 'ADD_TAG', target: 'security_alert' },
        ],
      });

    // 2. Create a ticket that triggers the rule
    const ticketRes = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${agentTokenA}`)
      .send({
        subject: 'Potential security vulnerability in auth header',
        description: 'We observed an unusual token parsing behavior.',
        customerId: new Types.ObjectId().toString(),
        tags: ['auth'],
      });

    expect(ticketRes.status).toBe(201);
    const createdTicket = ticketRes.body.data;

    // 3. Verify rule mutations applied automatically!
    expect(createdTicket.assigneeId).toBe(targetAgentId);
    expect(createdTicket.priority).toBe('URGENT');
    expect(createdTicket.tags).toContain('security_alert');
    expect(createdTicket.tags).toContain('auth');
  });

  it('allows dry-run test evaluation of rules via /test-evaluate', async () => {
    await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${leadTokenA}`)
      .send({
        name: 'VIP auto tag',
        event: 'TICKET_CREATED',
        conditions: [{ field: 'priority', operator: 'EQUALS', value: 'URGENT' }],
        actions: [{ type: 'ADD_TAG', target: 'vip_attention' }],
      });

    const evalRes = await request(app)
      .post('/api/v1/rules/test-evaluate')
      .set('Authorization', `Bearer ${agentTokenA}`)
      .send({
        ticket: {
          id: 'test_123',
          tenantId: tenantAId.toString(),
          subject: 'Database connection spike',
          description: 'Spike observed',
          status: 'OPEN',
          priority: 'URGENT',
          tags: [],
        },
      });

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.appliedRuleNames).toContain('VIP auto tag');
    expect(evalRes.body.updatedTicket.tags).toContain('vip_attention');
  });
});
