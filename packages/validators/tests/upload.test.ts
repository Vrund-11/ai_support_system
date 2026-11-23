import { describe, it, expect } from 'vitest';
import {
  presignUploadSchema,
  verifyUploadSchema,
  registerKbDocumentSchema,
} from '../src/upload.js';

describe('upload schemas', () => {
  describe('presignUploadSchema', () => {
    it('parses valid upload request with default attachment purpose', () => {
      const parsed = presignUploadSchema.parse({
        filename: '  manual.pdf  ',
        contentType: '  application/pdf  ',
        size: 1048576,
      });
      expect(parsed.filename).toBe('manual.pdf');
      expect(parsed.contentType).toBe('application/pdf');
      expect(parsed.size).toBe(1048576);
      expect(parsed.purpose).toBe('attachment');
    });

    it('accepts kb_document purpose', () => {
      const parsed = presignUploadSchema.parse({
        filename: 'doc.txt',
        contentType: 'text/plain',
        size: 500,
        purpose: 'kb_document',
      });
      expect(parsed.purpose).toBe('kb_document');
    });

    it('validates file size boundaries (positive up to 50MB)', () => {
      const fiftyMB = 50 * 1024 * 1024;
      expect(
        presignUploadSchema.parse({
          filename: 'small.bin',
          contentType: 'application/octet-stream',
          size: 1,
        }).size,
      ).toBe(1);

      expect(
        presignUploadSchema.parse({
          filename: 'max.bin',
          contentType: 'application/octet-stream',
          size: fiftyMB,
        }).size,
      ).toBe(fiftyMB);

      // Over 50MB
      expect(() =>
        presignUploadSchema.parse({
          filename: 'too-big.bin',
          contentType: 'application/octet-stream',
          size: fiftyMB + 1,
        }),
      ).toThrow();

      // Zero or negative
      expect(() =>
        presignUploadSchema.parse({
          filename: 'zero.bin',
          contentType: 'application/octet-stream',
          size: 0,
        }),
      ).toThrow();

      expect(() =>
        presignUploadSchema.parse({
          filename: 'neg.bin',
          contentType: 'application/octet-stream',
          size: -10,
        }),
      ).toThrow();
    });

    it('rejects empty or excessively long filename / contentType', () => {
      expect(() =>
        presignUploadSchema.parse({
          filename: '',
          contentType: 'text/plain',
          size: 100,
        }),
      ).toThrow();

      expect(() =>
        presignUploadSchema.parse({
          filename: 'a'.repeat(256),
          contentType: 'text/plain',
          size: 100,
        }),
      ).toThrow();

      expect(() =>
        presignUploadSchema.parse({
          filename: 'doc.txt',
          contentType: '',
          size: 100,
        }),
      ).toThrow();

      expect(() =>
        presignUploadSchema.parse({
          filename: 'doc.txt',
          contentType: 'b'.repeat(101),
          size: 100,
        }),
      ).toThrow();
    });
  });

  describe('verifyUploadSchema', () => {
    it('parses valid verify upload payload', () => {
      const parsed = verifyUploadSchema.parse({
        key: '  uploads/user1/doc.pdf  ',
        contentType: '  application/pdf  ',
      });
      expect(parsed.key).toBe('uploads/user1/doc.pdf');
      expect(parsed.contentType).toBe('application/pdf');
    });

    it('rejects empty strings for key or contentType', () => {
      expect(() => verifyUploadSchema.parse({ key: '', contentType: 'text/plain' })).toThrow();
      expect(() => verifyUploadSchema.parse({ key: 'key1', contentType: '' })).toThrow();
    });
  });

  describe('registerKbDocumentSchema', () => {
    it('parses upload source document with default contentType', () => {
      const parsed = registerKbDocumentSchema.parse({
        title: '  Getting Started Guide  ',
        source: 'upload',
        key: 'kb/guide.pdf',
      });
      expect(parsed.title).toBe('Getting Started Guide');
      expect(parsed.source).toBe('upload');
      expect(parsed.key).toBe('kb/guide.pdf');
      expect(parsed.contentType).toBe('application/pdf');
    });

    it('parses paste source document with custom contentType', () => {
      const parsed = registerKbDocumentSchema.parse({
        title: 'FAQ Snippet',
        source: 'paste',
        content: 'Q: How to reset password?\nA: Click forgot password.',
        contentType: 'text/markdown',
      });
      expect(parsed.source).toBe('paste');
      expect(parsed.content).toContain('reset password');
      expect(parsed.contentType).toBe('text/markdown');
    });

    it('parses url source document', () => {
      const parsed = registerKbDocumentSchema.parse({
        title: 'API Reference',
        source: 'url',
        content: 'https://docs.example.com/api',
      });
      expect(parsed.source).toBe('url');
      expect(parsed.content).toBe('https://docs.example.com/api');
    });

    it('rejects invalid source or invalid title', () => {
      expect(() =>
        registerKbDocumentSchema.parse({
          title: 'Invalid Doc',
          source: 'ftp' as any,
        }),
      ).toThrow();

      expect(() =>
        registerKbDocumentSchema.parse({
          title: '',
          source: 'paste',
        }),
      ).toThrow();

      expect(() =>
        registerKbDocumentSchema.parse({
          title: 'T'.repeat(256),
          source: 'paste',
        }),
      ).toThrow();
    });
  });
});
