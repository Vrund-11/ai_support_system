import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { TicketRepository } from '../src/repositories/ticket.repository.js';
import { Ticket } from '../src/models/ticket.model.js';
import { Counter } from '../src/models/counter.model.js';
import { getRedis, memoryRedis } from '../src/lib/redis.js';

describe('Ticket Counter Resilience & Fallback (Step 8)', () => {
  const tenantAId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantBId = new Types.ObjectId('507f1f77bcf86cd799439022');
  const customerId = new Types.ObjectId('507f191e810c19729de860bb');

  beforeEach(() => {
    vi.restoreAllMocks();
    memoryRedis.reset();
  });

  describe('Cold Cache Miss Fallback', () => {
    it('initializes sequence from max ticket number in DB on cold cache miss', async () => {
      const repo = new TicketRepository(tenantAId);
      const redis = getRedis();

      // Ensure Redis has no existing sequence key
      const key = `seq:${tenantAId}:ticket`;
      await redis.del(key);
      expect(await redis.exists(key)).toBe(0);

      // Simulate existing tickets up to #42 in MongoDB
      vi.spyOn(Ticket, 'findOne').mockReturnValue({
        sort: () => ({
          select: () => ({
            lean: async () => ({ number: 42 }),
          }),
        }),
      } as any);

      vi.spyOn(Counter, 'findOne').mockReturnValue({
        lean: async () => ({ value: 40 }),
      } as any);

      const nextNum = await repo.getNextTicketNumber();
      // Should discover max 42, set Redis key to 42 NX, and INCR to 43
      expect(nextNum).toBe(43);
      expect(await redis.get(key)).toBe('43');
    });

    it('initializes sequence to 1 for brand new tenant with no previous tickets', async () => {
      const repo = new TicketRepository(tenantAId);
      const redis = getRedis();
      const key = `seq:${tenantAId}:ticket`;
      await redis.del(key);

      vi.spyOn(Ticket, 'findOne').mockReturnValue({
        sort: () => ({
          select: () => ({
            lean: async () => null,
          }),
        }),
      } as any);

      vi.spyOn(Counter, 'findOne').mockReturnValue({
        lean: async () => null,
      } as any);

      const nextNum = await repo.getNextTicketNumber();
      expect(nextNum).toBe(1);
      expect(await redis.get(key)).toBe('1');
    });
  });

  describe('Multi-Tenant Counter Isolation', () => {
    it('increments Tenant A and Tenant B sequence counters independently', async () => {
      const repoA = new TicketRepository(tenantAId);
      const repoB = new TicketRepository(tenantBId);

      vi.spyOn(Ticket, 'findOne').mockReturnValue({
        sort: () => ({
          select: () => ({
            lean: async () => null,
          }),
        }),
      } as any);
      vi.spyOn(Counter, 'findOne').mockReturnValue({
        lean: async () => null,
      } as any);

      const a1 = await repoA.getNextTicketNumber();
      const a2 = await repoA.getNextTicketNumber();
      const b1 = await repoB.getNextTicketNumber();
      const a3 = await repoA.getNextTicketNumber();
      const b2 = await repoB.getNextTicketNumber();

      expect(a1).toBe(1);
      expect(a2).toBe(2);
      expect(a3).toBe(3);
      expect(b1).toBe(1);
      expect(b2).toBe(2);
    });
  });

  describe('Concurrent Ticket Number Allocation', () => {
    it('generates unique monotonic sequence numbers across concurrent requests', async () => {
      const repo = new TicketRepository(tenantAId);

      vi.spyOn(Ticket, 'findOne').mockReturnValue({
        sort: () => ({
          select: () => ({
            lean: async () => ({ number: 100 }),
          }),
        }),
      } as any);
      vi.spyOn(Counter, 'findOne').mockReturnValue({
        lean: async () => ({ value: 100 }),
      } as any);

      const concurrency = 20;
      const promises = Array.from({ length: concurrency }, () => repo.getNextTicketNumber());
      const results = await Promise.all(promises);

      // Verify no duplicates
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(concurrency);

      // Verify range from 101 to 120
      expect(Math.min(...results)).toBe(101);
      expect(Math.max(...results)).toBe(100 + concurrency);
    });
  });

  describe('Duplicate Key Error (Code 11000) Collision Recovery', () => {
    it('reconciles counter and retries when MongoDB throws code 11000 duplicate key error', async () => {
      const repo = new TicketRepository(tenantAId);
      vi.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({} as any);

      // Start with stale counter state
      let attempts = 0;
      vi.spyOn(repo, 'create').mockImplementation(async (doc: any) => {
        attempts++;
        if (attempts === 1) {
          const duplicateError: any = new Error(
            'E11000 duplicate key error collection: supportpilot.tickets index: tenantId_1_number_1 dup key: { tenantId: ObjectId("..."), number: 1 }',
          );
          duplicateError.code = 11000;
          throw duplicateError;
        }
        return {
          _id: new Types.ObjectId(),
          tenantId: tenantAId,
          number: doc.number,
          subject: doc.subject,
        } as any;
      });

      // When reconcile is called, simulate DB max is 5
      let findOneCalls = 0;
      vi.spyOn(Ticket, 'findOne').mockImplementation(() => {
        findOneCalls++;
        return {
          sort: () => ({
            select: () => ({
              lean: async () => ({ number: findOneCalls > 1 ? 5 : 0 }),
            }),
          }),
        } as any;
      });

      vi.spyOn(Counter, 'findOne').mockReturnValue({
        lean: async () => null,
      } as any);

      const ticket = await repo.createTicket({
        subject: 'Printer on fire',
        description: 'Need help urgently',
        customerId: customerId.toString(),
        priority: 'URGENT',
        tags: ['hardware'],
      });

      expect(attempts).toBe(2);
      expect(ticket.number).toBe(6); // Reconciled from 5 -> next is 6
    });
  });

  describe('Redis Outage Fallback', () => {
    it('falls back to MongoDB Counter when Redis is completely unavailable', async () => {
      const repo = new TicketRepository(tenantAId);
      const redis = getRedis();

      // Simulate Redis failure
      vi.spyOn(redis, 'exists').mockRejectedValue(new Error('Redis connection refused'));

      vi.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({
        tenantId: tenantAId,
        key: 'ticket_number',
        value: 77,
      } as any);

      const num = await repo.getNextTicketNumber();
      expect(num).toBe(77);
      expect(Counter.findOneAndUpdate).toHaveBeenCalledWith(
        { tenantId: tenantAId, key: 'ticket_number' },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    });
  });
});
