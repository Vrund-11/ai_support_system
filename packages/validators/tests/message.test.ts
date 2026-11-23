import { describe, it, expect } from 'vitest';
import { attachmentSchema, createMessageSchema } from '../src/message.js';

describe('message schemas', () => {
  describe('attachmentSchema', () => {
    it('parses valid attachment object', () => {
      const parsed = attachmentSchema.parse({
        key: 'attachments/abc.png',
        name: 'screenshot.png',
        size: 1024,
        mime: 'image/png',
      });
      expect(parsed.key).toBe('attachments/abc.png');
      expect(parsed.name).toBe('screenshot.png');
      expect(parsed.size).toBe(1024);
      expect(parsed.mime).toBe('image/png');
    });

    it('accepts 0 byte attachment', () => {
      const parsed = attachmentSchema.parse({
        key: 'empty.txt',
        name: 'empty.txt',
        size: 0,
        mime: 'text/plain',
      });
      expect(parsed.size).toBe(0);
    });

    it('rejects negative or non-integer size', () => {
      expect(() =>
        attachmentSchema.parse({
          key: 'file.txt',
          name: 'file.txt',
          size: -1,
          mime: 'text/plain',
        }),
      ).toThrow();

      expect(() =>
        attachmentSchema.parse({
          key: 'file.txt',
          name: 'file.txt',
          size: 10.5,
          mime: 'text/plain',
        }),
      ).toThrow();
    });

    it('rejects empty strings for key, name, or mime', () => {
      expect(() =>
        attachmentSchema.parse({ key: '', name: 'file.txt', size: 100, mime: 'text/plain' }),
      ).toThrow();
      expect(() =>
        attachmentSchema.parse({ key: 'k', name: '', size: 100, mime: 'text/plain' }),
      ).toThrow();
      expect(() =>
        attachmentSchema.parse({ key: 'k', name: 'file.txt', size: 100, mime: '' }),
      ).toThrow();
    });
  });

  describe('createMessageSchema', () => {
    it('parses minimal message with defaults', () => {
      const parsed = createMessageSchema.parse({
        body: '  Here is my issue description  ',
      });
      expect(parsed.body).toBe('Here is my issue description');
      expect(parsed.isInternal).toBe(false);
      expect(parsed.attachments).toEqual([]);
      expect(parsed.clientId).toBeUndefined();
    });

    it('parses complete message with attachments and clientId', () => {
      const parsed = createMessageSchema.parse({
        body: 'Internal note for agents',
        isInternal: true,
        attachments: [
          {
            key: 'k1',
            name: 'diag.log',
            size: 512,
            mime: 'text/plain',
          },
        ],
        clientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });
      expect(parsed.isInternal).toBe(true);
      expect(parsed.attachments).toHaveLength(1);
      expect(parsed.clientId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    });

    it('rejects empty body or whitespace-only body', () => {
      expect(() => createMessageSchema.parse({ body: '' })).toThrow();
      expect(() => createMessageSchema.parse({ body: '     ' })).toThrow();
    });

    it('rejects body longer than 10000 characters', () => {
      expect(() =>
        createMessageSchema.parse({
          body: 'a'.repeat(10001),
        }),
      ).toThrow();
    });

    it('rejects invalid uuid for clientId', () => {
      expect(() =>
        createMessageSchema.parse({
          body: 'Hello',
          clientId: 'not-a-valid-uuid',
        }),
      ).toThrow();
    });
  });
});
