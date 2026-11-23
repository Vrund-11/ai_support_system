import { describe, it, expect } from 'vitest';
import {
  ticketStatusSchema,
  ticketPrioritySchema,
  createTicketSchema,
  updateTicketSchema,
  bulkTicketActionSchema,
  ticketFilterSchema,
} from '../src/ticket.js';

describe('ticket schemas', () => {
  describe('ticketStatusSchema', () => {
    it('accepts all valid ticket statuses', () => {
      const statuses = [
        'NEW',
        'OPEN',
        'PENDING_CUSTOMER',
        'ON_HOLD',
        'RESOLVED',
        'CLOSED',
      ] as const;
      for (const s of statuses) {
        expect(ticketStatusSchema.parse(s)).toBe(s);
      }
    });

    it('rejects invalid status', () => {
      expect(() => ticketStatusSchema.parse('IN_PROGRESS')).toThrow();
      expect(() => ticketStatusSchema.parse('')).toThrow();
    });
  });

  describe('ticketPrioritySchema', () => {
    it('accepts all valid ticket priorities', () => {
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
      for (const p of priorities) {
        expect(ticketPrioritySchema.parse(p)).toBe(p);
      }
    });

    it('rejects invalid priority', () => {
      expect(() => ticketPrioritySchema.parse('CRITICAL')).toThrow();
      expect(() => ticketPrioritySchema.parse('')).toThrow();
    });
  });

  describe('createTicketSchema', () => {
    const validMinimal = {
      subject: 'Login failure',
      description: 'Getting error 500 when logging into portal',
      customerId: 'cust_12345',
    };

    it('parses minimal ticket and assigns defaults', () => {
      const parsed = createTicketSchema.parse(validMinimal);
      expect(parsed.subject).toBe('Login failure');
      expect(parsed.description).toBe('Getting error 500 when logging into portal');
      expect(parsed.customerId).toBe('cust_12345');
      expect(parsed.priority).toBe('MEDIUM');
      expect(parsed.tags).toEqual([]);
      expect(parsed.attachments).toEqual([]);
      expect(parsed.customFields).toEqual({});
      expect(parsed.linkedTicketIds).toEqual([]);
      expect(parsed.assigneeId).toBeUndefined();
    });

    it('parses full ticket with all fields populated', () => {
      const parsed = createTicketSchema.parse({
        subject: '   Payment Gateway Timeout   ',
        description: '   Users report payment timeouts on checkout page   ',
        customerId: 'cust_abc',
        priority: 'URGENT',
        assigneeId: 'agent_99',
        tags: ['  billing  ', 'urgent '],
        attachments: [
          {
            key: 'uploads/err.png',
            name: 'err.png',
            size: 2048,
            mime: 'image/png',
          },
        ],
        customFields: { plan: 'enterprise', tier: 1 },
        linkedTicketIds: ['tkt_1', 'tkt_2'],
      });

      expect(parsed.subject).toBe('Payment Gateway Timeout');
      expect(parsed.description).toBe('Users report payment timeouts on checkout page');
      expect(parsed.priority).toBe('URGENT');
      expect(parsed.assigneeId).toBe('agent_99');
      expect(parsed.tags).toEqual(['billing', 'urgent']);
      expect(parsed.attachments).toHaveLength(1);
      expect(parsed.customFields).toEqual({ plan: 'enterprise', tier: 1 });
      expect(parsed.linkedTicketIds).toEqual(['tkt_1', 'tkt_2']);
    });

    it('validates subject length boundaries (3 to 250)', () => {
      expect(createTicketSchema.parse({ ...validMinimal, subject: 'Abc' }).subject).toBe('Abc');
      expect(createTicketSchema.parse({ ...validMinimal, subject: 'A'.repeat(250) }).subject).toBe(
        'A'.repeat(250),
      );

      expect(() => createTicketSchema.parse({ ...validMinimal, subject: 'Ab' })).toThrow();
      expect(() =>
        createTicketSchema.parse({ ...validMinimal, subject: 'A'.repeat(251) }),
      ).toThrow();
    });

    it('validates description length boundaries (5 to 10000)', () => {
      expect(createTicketSchema.parse({ ...validMinimal, description: 'Hello' }).description).toBe(
        'Hello',
      );
      expect(
        createTicketSchema.parse({ ...validMinimal, description: 'D'.repeat(10000) }).description,
      ).toBe('D'.repeat(10000));

      expect(() => createTicketSchema.parse({ ...validMinimal, description: 'Four' })).toThrow();
      expect(() =>
        createTicketSchema.parse({ ...validMinimal, description: 'D'.repeat(10001) }),
      ).toThrow();
    });

    it('rejects empty customerId', () => {
      expect(() => createTicketSchema.parse({ ...validMinimal, customerId: '' })).toThrow();
    });
  });

  describe('updateTicketSchema', () => {
    it('requires a positive integer version', () => {
      expect(updateTicketSchema.parse({ version: 1 }).version).toBe(1);
      expect(() => updateTicketSchema.parse({ version: 0 })).toThrow();
      expect(() => updateTicketSchema.parse({ version: -1 })).toThrow();
      expect(() => updateTicketSchema.parse({ version: 1.5 })).toThrow();
      expect(() => updateTicketSchema.parse({})).toThrow();
    });

    it('allows updating fields including nullable assigneeId', () => {
      const parsedWithNull = updateTicketSchema.parse({
        version: 2,
        status: 'RESOLVED',
        priority: 'LOW',
        assigneeId: null,
        tags: [' resolved '],
        customFields: { resolvedBy: 'bot' },
        linkedTicketIds: ['tkt_9'],
      });

      expect(parsedWithNull.assigneeId).toBeNull();
      expect(parsedWithNull.status).toBe('RESOLVED');
      expect(parsedWithNull.priority).toBe('LOW');
      expect(parsedWithNull.tags).toEqual(['resolved']);

      const parsedWithAgent = updateTicketSchema.parse({
        version: 3,
        assigneeId: 'agent_42',
      });
      expect(parsedWithAgent.assigneeId).toBe('agent_42');
    });
  });

  describe('bulkTicketActionSchema', () => {
    it('parses ASSIGN action with string value or null value', () => {
      const assignUser = bulkTicketActionSchema.parse({
        ticketIds: ['tkt_1', 'tkt_2'],
        action: 'ASSIGN',
        value: 'agent_1',
      });
      expect(assignUser.action).toBe('ASSIGN');
      expect(assignUser.value).toBe('agent_1');

      const unassign = bulkTicketActionSchema.parse({
        ticketIds: ['tkt_1'],
        action: 'ASSIGN',
        value: null,
      });
      expect(unassign.value).toBeNull();
    });

    it('parses TAG action with string or array of strings', () => {
      const singleTag = bulkTicketActionSchema.parse({
        ticketIds: ['tkt_1'],
        action: 'TAG',
        value: 'priority',
      });
      expect(singleTag.value).toBe('priority');

      const multiTag = bulkTicketActionSchema.parse({
        ticketIds: ['tkt_1'],
        action: 'TAG',
        value: ['vip', 'escalated'],
      });
      expect(multiTag.value).toEqual(['vip', 'escalated']);
    });

    it('parses STATUS action with string value', () => {
      const parsed = bulkTicketActionSchema.parse({
        ticketIds: ['tkt_1'],
        action: 'STATUS',
        value: 'CLOSED',
      });
      expect(parsed.action).toBe('STATUS');
      expect(parsed.value).toBe('CLOSED');
    });

    it('rejects empty ticketIds array or empty string in ticketIds', () => {
      expect(() =>
        bulkTicketActionSchema.parse({
          ticketIds: [],
          action: 'ASSIGN',
          value: 'agent_1',
        }),
      ).toThrow();

      expect(() =>
        bulkTicketActionSchema.parse({
          ticketIds: [''],
          action: 'ASSIGN',
          value: 'agent_1',
        }),
      ).toThrow();
    });

    it('rejects invalid action or invalid value type', () => {
      expect(() =>
        bulkTicketActionSchema.parse({
          ticketIds: ['tkt_1'],
          action: 'DELETE' as any,
          value: null,
        }),
      ).toThrow();

      expect(() =>
        bulkTicketActionSchema.parse({
          ticketIds: ['tkt_1'],
          action: 'STATUS',
          value: 12345 as any,
        }),
      ).toThrow();
    });
  });

  describe('ticketFilterSchema', () => {
    it('applies default limit of 20', () => {
      const parsed = ticketFilterSchema.parse({});
      expect(parsed.limit).toBe(20);
    });

    it('parses single status or array of statuses', () => {
      const single = ticketFilterSchema.parse({ status: 'OPEN' });
      expect(single.status).toBe('OPEN');

      const multi = ticketFilterSchema.parse({ status: ['OPEN', 'PENDING_CUSTOMER'] });
      expect(multi.status).toEqual(['OPEN', 'PENDING_CUSTOMER']);
    });

    it('parses single priority or array of priorities', () => {
      const single = ticketFilterSchema.parse({ priority: 'HIGH' });
      expect(single.priority).toBe('HIGH');

      const multi = ticketFilterSchema.parse({ priority: ['LOW', 'HIGH'] });
      expect(multi.priority).toEqual(['LOW', 'HIGH']);
    });

    it('parses date filters in ISO 8601 format', () => {
      const parsed = ticketFilterSchema.parse({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T23:59:59.999Z',
      });
      expect(parsed.from).toBe('2026-01-01T00:00:00.000Z');
      expect(parsed.to).toBe('2026-01-31T23:59:59.999Z');
    });

    it('rejects invalid date strings', () => {
      expect(() => ticketFilterSchema.parse({ from: 'not-a-datetime' })).toThrow();
      expect(() => ticketFilterSchema.parse({ to: '2026-02-30' })).toThrow();
    });

    it('coerces limit string and checks boundaries (1 to 50)', () => {
      expect(ticketFilterSchema.parse({ limit: '1' }).limit).toBe(1);
      expect(ticketFilterSchema.parse({ limit: '50' }).limit).toBe(50);

      expect(() => ticketFilterSchema.parse({ limit: 0 })).toThrow();
      expect(() => ticketFilterSchema.parse({ limit: 51 })).toThrow();
    });

    it('parses general search and identifier filters', () => {
      const parsed = ticketFilterSchema.parse({
        assigneeId: 'agent_1',
        assignedAgentId: 'agent_2',
        tag: 'support',
        q: 'printer issue',
        cursor: 'cursor_xyz',
      });
      expect(parsed.assigneeId).toBe('agent_1');
      expect(parsed.assignedAgentId).toBe('agent_2');
      expect(parsed.tag).toBe('support');
      expect(parsed.q).toBe('printer issue');
      expect(parsed.cursor).toBe('cursor_xyz');
    });
  });
});
