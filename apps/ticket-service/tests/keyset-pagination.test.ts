import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { Ticket } from '../src/models/ticket.model.js';
import { Message } from '../src/models/message.model.js';
import { TicketRepository } from '../src/repositories/ticket.repository.js';
import { MessageRepository } from '../src/repositories/message.repository.js';

describe('Feature 33 & 34: Keyset Pagination, Compound Indexes & Message ClientId Idempotency', () => {
  const tenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const ticketRepo = new TicketRepository(tenantId);
  const messageRepo = new MessageRepository(tenantId);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('MongoDB Compound Index Declarations', () => {
    it('declares compound index on (tenantId, status, priority, updatedAt: -1)', () => {
      const indexes = Ticket.schema.indexes();
      const idx = indexes.find(
        ([fields]) =>
          fields['tenantId'] === 1 &&
          fields['status'] === 1 &&
          fields['priority'] === 1 &&
          fields['updatedAt'] === -1,
      );
      expect(idx).toBeDefined();
    });

    it('declares compound index on (tenantId, assigneeId, status, updatedAt: -1)', () => {
      const indexes = Ticket.schema.indexes();
      const idx = indexes.find(
        ([fields]) =>
          fields['tenantId'] === 1 &&
          fields['assigneeId'] === 1 &&
          fields['status'] === 1 &&
          fields['updatedAt'] === -1,
      );
      expect(idx).toBeDefined();
    });

    it('declares compound index on (tenantId, updatedAt: -1, _id: -1)', () => {
      const indexes = Ticket.schema.indexes();
      const idx = indexes.find(
        ([fields]) =>
          fields['tenantId'] === 1 && fields['updatedAt'] === -1 && fields['_id'] === -1,
      );
      expect(idx).toBeDefined();
    });

    it('declares unique partial compound index on (tenantId, ticketId, clientId) in Message model', () => {
      const indexes = Message.schema.indexes();
      const idx = indexes.find(
        ([fields, options]) =>
          fields['tenantId'] === 1 &&
          fields['ticketId'] === 1 &&
          fields['clientId'] === 1 &&
          options?.unique === true &&
          options?.partialFilterExpression?.['clientId']?.$type === 'string',
      );
      expect(idx).toBeDefined();
    });
  });

  describe('Keyset Cursor Pagination', () => {
    it('decodes base64 JSON cursor and builds (updatedAt, _id) compound inequality filter', async () => {
      const cursorDate = new Date('2026-11-20T10:00:00.000Z');
      const cursorId = new Types.ObjectId();
      const encodedCursor = Buffer.from(
        JSON.stringify({ updatedAt: cursorDate.toISOString(), _id: cursorId.toString() }),
      ).toString('base64');

      const findSpy = vi.spyOn(Ticket, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any);

      await ticketRepo.listTickets({
        cursor: encodedCursor,
        limit: 20,
      });

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          $or: [
            { updatedAt: { $lt: cursorDate } },
            { updatedAt: cursorDate, _id: { $lt: cursorId } },
          ],
        }),
      );
    });

    it('caps pagination limit at 50 even if higher limit requested', async () => {
      const limitSpy = vi.fn().mockResolvedValue([]);
      vi.spyOn(Ticket, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: limitSpy,
      } as any);

      await ticketRepo.listTickets({
        limit: 100 as any, // Try to exceed 50
      });

      // findWithPagination requests limit + 1 (51) to detect hasMore
      expect(limitSpy).toHaveBeenCalledWith(51);
    });

    it('encodes last item as base64 cursor when hasMore is true', async () => {
      const mockItems = Array.from({ length: 21 }, (_, i) => ({
        _id: new Types.ObjectId(),
        tenantId,
        subject: `Ticket ${i}`,
        updatedAt: new Date(Date.now() - i * 1000),
      }));

      vi.spyOn(Ticket, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockItems),
      } as any);

      const result = await ticketRepo.listTickets({ limit: 20 });
      expect(result.items.length).toBe(20);
      expect(result.nextCursor).toBeDefined();

      const decoded = JSON.parse(Buffer.from(result.nextCursor!, 'base64').toString('utf8'));
      expect(decoded.updatedAt).toBe(mockItems[19]!.updatedAt.toISOString());
      expect(decoded._id).toBe(mockItems[19]!._id.toString());
    });

    it('handles cursor with invalid date without throwing CastError', async () => {
      const invalidCursor = Buffer.from(
        JSON.stringify({ updatedAt: 'invalid-date-string', _id: new Types.ObjectId().toString() }),
      ).toString('base64');
      const findSpy = vi.spyOn(Ticket, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any);

      await expect(ticketRepo.listTickets({ cursor: invalidCursor })).resolves.not.toThrow();
      expect(findSpy).toHaveBeenCalled();
    });
  });

  describe('Message clientId Idempotency & Deduplication', () => {
    it('returns existing message without creating duplicate when identical clientId is submitted', async () => {
      const ticketId = new Types.ObjectId();
      const clientId = 'c56a4180-65aa-42ec-a945-5fd21dec0538';
      const existingMessage = {
        _id: new Types.ObjectId(),
        tenantId,
        ticketId,
        clientId,
        seq: 5,
        body: 'Original optimistic message',
        senderType: 'AGENT',
        isInternal: false,
      };

      const findOneSpy = vi.spyOn(Message, 'findOne').mockResolvedValue(existingMessage as any);
      const createSpy = vi.spyOn(Message.prototype, 'save');

      const result = await messageRepo.addMessageToTicket(ticketId, {
        body: 'Original optimistic message',
        isInternal: false,
        attachments: [],
        clientId,
      });

      expect(findOneSpy).toHaveBeenCalledWith({
        tenantId,
        ticketId,
        clientId,
      });
      expect(createSpy).not.toHaveBeenCalled();
      expect(result).toBe(existingMessage);
    });
  });
});
