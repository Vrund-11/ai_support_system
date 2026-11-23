import { describe, it, expect } from 'vitest';
import { createCustomerSchema, customerFilterSchema } from '../src/customer.js';

describe('customer schemas', () => {
  describe('createCustomerSchema', () => {
    it('parses valid customer with defaults', () => {
      const parsed = createCustomerSchema.parse({
        email: '  customer@example.com  ',
        name: '  Jane Doe  ',
      });
      expect(parsed.email).toBe('customer@example.com');
      expect(parsed.name).toBe('Jane Doe');
      expect(parsed.visitorIds).toEqual([]);
      expect(parsed.externalId).toBeUndefined();
    });

    it('parses valid customer with all optional fields', () => {
      const parsed = createCustomerSchema.parse({
        email: 'customer@example.com',
        name: 'Jane Doe',
        externalId: '  ext-999  ',
        visitorIds: ['vis-1', 'vis-2'],
      });
      expect(parsed.externalId).toBe('ext-999');
      expect(parsed.visitorIds).toEqual(['vis-1', 'vis-2']);
    });

    it('rejects invalid email', () => {
      expect(() =>
        createCustomerSchema.parse({
          email: 'not-an-email',
          name: 'Jane Doe',
        }),
      ).toThrow();
    });

    it('rejects empty name or name > 150 chars', () => {
      expect(() =>
        createCustomerSchema.parse({
          email: 'customer@example.com',
          name: '',
        }),
      ).toThrow();

      expect(() =>
        createCustomerSchema.parse({
          email: 'customer@example.com',
          name: 'A'.repeat(151),
        }),
      ).toThrow();
    });

    it('rejects missing required fields', () => {
      expect(() => createCustomerSchema.parse({})).toThrow();
    });
  });

  describe('customerFilterSchema', () => {
    it('applies default limit of 25 when empty', () => {
      const parsed = customerFilterSchema.parse({});
      expect(parsed.limit).toBe(25);
      expect(parsed.q).toBeUndefined();
      expect(parsed.cursor).toBeUndefined();
    });

    it('parses full filter query with string coerced limit', () => {
      const parsed = customerFilterSchema.parse({
        q: 'Acme',
        cursor: 'cur_abc123',
        limit: '50',
      });
      expect(parsed.q).toBe('Acme');
      expect(parsed.cursor).toBe('cur_abc123');
      expect(parsed.limit).toBe(50);
    });

    it('validates limit boundaries (1 to 100)', () => {
      expect(customerFilterSchema.parse({ limit: 1 }).limit).toBe(1);
      expect(customerFilterSchema.parse({ limit: 100 }).limit).toBe(100);

      expect(() => customerFilterSchema.parse({ limit: 0 })).toThrow();
      expect(() => customerFilterSchema.parse({ limit: 101 })).toThrow();
      expect(() => customerFilterSchema.parse({ limit: 2.5 })).toThrow();
    });
  });
});
