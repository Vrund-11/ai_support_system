import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { Ticket } from '../src/models/ticket.model.js';
import { TicketRepository } from '../src/repositories/ticket.repository.js';

describe('Ticket Indexes & Search (S1-T09: TKT-7)', () => {
  const tenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const repo = new TicketRepository(tenantId);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mongoose Schema Index Declarations', () => {
    it('defines compound unique index on (tenantId, number)', () => {
      const indexes = Ticket.schema.indexes();
      const numberIndex = indexes.find(
        ([fields, options]) =>
          fields['tenantId'] === 1 && fields['number'] === 1 && options?.unique === true,
      );
      expect(numberIndex).toBeDefined();
    });

    it('defines compound index on (tenantId, status, priority, updatedAt)', () => {
      const indexes = Ticket.schema.indexes();
      const statusIndex = indexes.find(
        ([fields]) =>
          fields['tenantId'] === 1 &&
          fields['status'] === 1 &&
          fields['priority'] === 1 &&
          fields['updatedAt'] === -1,
      );
      expect(statusIndex).toBeDefined();
    });

    it('defines compound index on (tenantId, assigneeId, status)', () => {
      const indexes = Ticket.schema.indexes();
      const assigneeIndex = indexes.find(
        ([fields]) =>
          fields['tenantId'] === 1 && fields['assigneeId'] === 1 && fields['status'] === 1,
      );
      expect(assigneeIndex).toBeDefined();
    });

    it('defines compound index on (tenantId, tags, status)', () => {
      const indexes = Ticket.schema.indexes();
      const tagsIndex = indexes.find(
        ([fields]) => fields['tenantId'] === 1 && fields['tags'] === 1 && fields['status'] === 1,
      );
      expect(tagsIndex).toBeDefined();
    });

    it('defines compound index on (tenantId, createdAt)', () => {
      const indexes = Ticket.schema.indexes();
      const createdAtIndex = indexes.find(
        ([fields]) => fields['tenantId'] === 1 && fields['createdAt'] === -1,
      );
      expect(createdAtIndex).toBeDefined();
    });

    it('defines tenant-scoped compound text search index with weighted fields', () => {
      const indexes = Ticket.schema.indexes();
      const textIndex = indexes.find(
        ([fields]) =>
          fields['tenantId'] === 1 &&
          fields['subject'] === 'text' &&
          fields['description'] === 'text',
      );
      expect(textIndex).toBeDefined();
      const options = textIndex?.[1];
      expect(options?.weights).toEqual({ subject: 10, description: 1 });
      expect(options?.name).toBe('ticket_text_search');
    });
  });

  describe('Free-text and Multi-filter Query Building', () => {
    it('builds scoped free text search query when q is specified', async () => {
      const findSpy = vi.spyOn(Ticket, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any);

      await repo.listTickets({
        q: 'authentication failure',
        limit: 25,
      });

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          $text: { $search: 'authentication failure' },
        }),
      );
    });

    it('builds multi-filter query with status, priority, assignee, tag, date range', async () => {
      const findSpy = vi.spyOn(Ticket, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any);

      const assigneeId = new Types.ObjectId().toString();
      await repo.listTickets({
        status: ['OPEN', 'PENDING_CUSTOMER'],
        priority: 'HIGH',
        assigneeId,
        tag: 'billing',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.999Z',
        limit: 50,
      });

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          status: { $in: ['OPEN', 'PENDING_CUSTOMER'] },
          priority: { $in: ['HIGH'] },
          assigneeId: new Types.ObjectId(assigneeId),
          tags: { $in: ['billing'] },
          createdAt: {
            $gte: new Date('2026-01-01T00:00:00.000Z'),
            $lte: new Date('2026-01-31T23:59:59.999Z'),
          },
        }),
      );
    });
  });

  describe('explainListTickets Execution Stats', () => {
    it('calls .explain("executionStats") on query and returns execution plan', async () => {
      const mockExplainResult = {
        queryPlanner: {
          plannerVersion: 1,
          namespace: 'supportpilot.tickets',
          indexFilterSet: false,
          winningPlan: {
            stage: 'FETCH',
            inputStage: {
              stage: 'IXSCAN',
              keyPattern: { tenantId: 1, status: 1, priority: 1, updatedAt: -1 },
              indexName: 'tenantId_1_status_1_priority_1_updatedAt_-1',
            },
          },
        },
        executionStats: {
          executionSuccess: true,
          nReturned: 25,
          executionTimeMillis: 2,
          totalKeysExamined: 25,
          totalDocsExamined: 25,
          executionStages: {
            stage: 'FETCH',
            nReturned: 25,
            docsExamined: 25,
            inputStage: {
              stage: 'IXSCAN',
              nReturned: 25,
              keysExamined: 25,
            },
          },
        },
      };

      vi.spyOn(Ticket, 'find').mockReturnValue({
        explain: vi.fn().mockResolvedValue(mockExplainResult),
      } as any);

      const plan = await repo.explainListTickets({
        status: 'OPEN',
        priority: 'HIGH',
        limit: 25,
      });

      expect(plan).toBeDefined();
      expect((plan as any).executionStats.executionStages.inputStage.stage).toBe('IXSCAN');
      expect((plan as any).executionStats.totalDocsExamined).toBe(25);
    });
  });
});
