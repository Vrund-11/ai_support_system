import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { Ticket } from '../src/models/ticket.model.js';
import { User } from '../src/models/user.model.js';
import { TicketEvent } from '../src/models/ticket-event.model.js';
import { TicketEventRepository } from '../src/repositories/ticket-event.repository.js';
import { AssignmentService } from '../src/services/assignment.service.js';
import { TenantQuotaTracker } from '../src/middleware/quota.middleware.js';

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
const agent2Id = new Types.ObjectId('507f191e810c19729de860bb');

function createToken(role = 'AGENT', userId = agentId): string {
  return jwt.sign({ sub: userId.toString(), tenantId: tenantId.toString(), role }, ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

describe('TEN-4, TKT-4, TKT-8, TKT-6, NOTIF-4 Backend Tests', () => {
  const app = createApp('silent');
  const token = createToken('AGENT');

  beforeEach(() => {
    vi.restoreAllMocks();
    TenantQuotaTracker.resetInMemory();
    AssignmentService.resetCounters();
    vi.spyOn(TicketEventRepository.prototype, 'recordEvent').mockResolvedValue({} as any);
  });

  describe('TEN-4: Tenant Quota Tracking & Middleware', () => {
    it('sets X-Quota-Remaining-* headers on responses', async () => {
      vi.spyOn(User, 'findOne').mockResolvedValue({
        _id: agentId,
        email: 'agent@test.com',
        name: 'Agent Test',
        role: 'AGENT',
      } as any);

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.headers).toHaveProperty('x-quota-remaining-messages');
      expect(res.headers).toHaveProperty('x-quota-remaining-ai');
      expect(res.headers).toHaveProperty('x-quota-remaining-kb');
      expect(parseInt(res.headers['x-quota-remaining-messages'], 10)).toBeGreaterThan(0);
    });

    it('returns 429 when tenant daily message quota is exhausted', async () => {
      // Simulate maxed-out usage
      await TenantQuotaTracker.incrementUsage(tenantId.toString(), 'messages', 500);

      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          subject: 'Test Subject',
          description: 'Valid description text here',
          customerId: '507f191e810c19729de860cc',
        });

      expect(res.status).toBe(429);
      expect(res.body.type).toBe('/errors/quota-exceeded');
    });
  });

  describe('TKT-4: Round-robin and Least-loaded AssignmentService', () => {
    it('cycles agents via round-robin', async () => {
      const mockAgents = [
        { _id: agentId, role: 'AGENT', status: 'ACTIVE' },
        { _id: agent2Id, role: 'AGENT', status: 'ACTIVE' },
      ];

      vi.spyOn(User, 'find').mockReturnValue({
        sort: () => ({
          select: () => ({
            lean: async () => mockAgents,
          }),
        }),
      } as any);

      const first = await AssignmentService.getNextAgent(tenantId, 'round-robin');
      const second = await AssignmentService.getNextAgent(tenantId, 'round-robin');
      const third = await AssignmentService.getNextAgent(tenantId, 'round-robin');

      expect(first).toBe(agentId.toString());
      expect(second).toBe(agent2Id.toString());
      expect(third).toBe(agentId.toString());
    });

    it('picks agent with fewest open tickets in least-loaded', async () => {
      const mockAgents = [
        { _id: agentId, role: 'AGENT', status: 'ACTIVE' },
        { _id: agent2Id, role: 'AGENT', status: 'ACTIVE' },
      ];

      vi.spyOn(User, 'find').mockReturnValue({
        sort: () => ({
          select: () => ({
            lean: async () => mockAgents,
          }),
        }),
      } as any);

      // agentId has 5 open tickets, agent2Id has 1 open ticket
      vi.spyOn(Ticket, 'aggregate').mockResolvedValue([
        { _id: agentId, count: 5 },
        { _id: agent2Id, count: 1 },
      ] as any);

      const selected = await AssignmentService.getNextAgent(tenantId, 'least-loaded');
      expect(selected).toBe(agent2Id.toString());
    });
  });

  describe('TKT-8: Bulk Ticket Actions (POST /api/v1/tickets/bulk)', () => {
    it('bulk assigns tickets to target agent', async () => {
      const ticket1Id = new Types.ObjectId();
      const ticket2Id = new Types.ObjectId();

      const doc1 = {
        _id: ticket1Id,
        tenantId,
        assigneeId: undefined as Types.ObjectId | undefined,
        tags: [],
        status: 'OPEN',
        version: 1,
        save: vi.fn().mockResolvedValue(true),
      };

      const doc2 = {
        _id: ticket2Id,
        tenantId,
        assigneeId: undefined as Types.ObjectId | undefined,
        tags: [],
        status: 'OPEN',
        version: 1,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Ticket, 'findOne').mockImplementation((filter: any) => {
        if (filter._id.equals(ticket1Id)) return Promise.resolve(doc1 as any);
        if (filter._id.equals(ticket2Id)) return Promise.resolve(doc2 as any);
        return Promise.resolve(null);
      });

      vi.spyOn(TicketEvent, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/tickets/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ticketIds: [ticket1Id.toString(), ticket2Id.toString()],
          action: 'ASSIGN',
          value: agentId.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.data.updatedCount).toBe(2);
      expect(doc1.assigneeId?.toString()).toBe(agentId.toString());
      expect(doc2.assigneeId?.toString()).toBe(agentId.toString());
    });

    it('bulk tags tickets', async () => {
      const ticket1Id = new Types.ObjectId();
      const doc1 = {
        _id: ticket1Id,
        tenantId,
        tags: ['billing'],
        status: 'OPEN',
        version: 1,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Ticket, 'findOne').mockResolvedValue(doc1 as any);
      vi.spyOn(TicketEvent, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/tickets/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ticketIds: [ticket1Id.toString()],
          action: 'TAG',
          value: 'urgent-review',
        });

      expect(res.status).toBe(200);
      expect(doc1.tags).toContain('billing');
      expect(doc1.tags).toContain('urgent-review');
    });
  });

  describe('TKT-6: Ticket Custom Fields & Linking Tickets', () => {
    it('links two tickets bidirectionally', async () => {
      const ticket1Id = new Types.ObjectId();
      const ticket2Id = new Types.ObjectId();

      const doc1 = {
        _id: ticket1Id,
        tenantId,
        linkedTicketIds: [] as Types.ObjectId[],
        version: 1,
        save: vi.fn().mockResolvedValue(true),
      };

      const doc2 = {
        _id: ticket2Id,
        tenantId,
        linkedTicketIds: [] as Types.ObjectId[],
        version: 1,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Ticket, 'findOne').mockImplementation((filter: any) => {
        if (filter._id.equals(ticket1Id)) return Promise.resolve(doc1 as any);
        if (filter._id.equals(ticket2Id)) return Promise.resolve(doc2 as any);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .post(`/api/v1/tickets/${ticket1Id.toString()}/link`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetTicketId: ticket2Id.toString() });

      expect(res.status).toBe(200);
      expect(doc1.linkedTicketIds.some((id) => id.equals(ticket2Id))).toBe(true);
      expect(doc2.linkedTicketIds.some((id) => id.equals(ticket1Id))).toBe(true);
    });
  });

  describe('NOTIF-4: User Notification Preferences', () => {
    it('updates user notification preferences via PATCH /api/v1/users/me/preferences', async () => {
      const mockUser = {
        _id: agentId,
        tenantId,
        email: 'agent@test.com',
        name: 'Agent Test',
        role: 'AGENT',
        notificationPrefs: { email: true, push: true, inApp: true },
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, 'findOne').mockResolvedValue(mockUser as any);

      const res = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: false, push: true, inApp: false });

      expect(res.status).toBe(200);
      expect(mockUser.notificationPrefs.email).toBe(false);
      expect(mockUser.notificationPrefs.push).toBe(true);
      expect(mockUser.notificationPrefs.inApp).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
