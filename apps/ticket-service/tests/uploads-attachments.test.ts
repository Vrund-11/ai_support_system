import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { S3Client } from '@aws-sdk/client-s3';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { setS3Client } from '../src/lib/s3.js';
import { detectMimeType, validateFileSignature, isExecutable } from '../src/lib/magic-bytes.js';
import { Ticket } from '../src/models/ticket.model.js';
import { Message } from '../src/models/message.model.js';
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
const customerId = new Types.ObjectId('507f191e810c19729de860bb');

function createToken(
  tenantId: Types.ObjectId,
  role: 'OWNER' | 'LEAD' | 'AGENT' | 'VIEWER' = 'AGENT',
): string {
  return jwt.sign(
    { sub: '507f191e810c19729de860aa', tenantId: tenantId.toString(), role },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

describe('S2-T05: S3 Presigned Uploads, Magic Bytes Verification & Attachments (KB-1, T-FILE-01)', () => {
  const app = createApp('silent');
  const tokenAgentA = createToken(tenantAId, 'AGENT');
  const tokenLeadA = createToken(tenantAId, 'LEAD');
  const tokenOwnerA = createToken(tenantAId, 'OWNER');

  // Sample file buffers
  const genuinePdfBuffer = Buffer.from(
    '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
  );
  const genuinePngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const genuineJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
  ]);
  const genuineGifBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00');
  const genuineTextBuffer = Buffer.from(
    'Hello, SupportPilot! This is a plain markdown file.\n# Heading',
  );
  const genuineJsonBuffer = Buffer.from('{"name": "SupportPilot", "active": true}');

  // Spoofed buffers
  const spoofedExeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // Windows PE/MZ header
  const spoofedElfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]); // Linux ELF header
  const spoofedBinaryInText = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0xff, 0xfe]); // Null bytes & control chars

  beforeEach(() => {
    vi.restoreAllMocks();
    setS3Client(null); // Reset client to default

    vi.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({ value: 1 } as never);
    vi.spyOn(TicketEvent.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      return Promise.resolve(this);
    });
    vi.spyOn(Ticket.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      return Promise.resolve(this);
    });
    vi.spyOn(Message.prototype, 'save').mockImplementation(function (this: any) {
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      return Promise.resolve(this);
    });
  });

  describe('1. Magic Bytes & File Signature Detection (Unit Tests)', () => {
    it('detects genuine PDF magic bytes', () => {
      expect(detectMimeType(genuinePdfBuffer)).toBe('application/pdf');
      const result = validateFileSignature(genuinePdfBuffer, 'application/pdf');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('application/pdf');
    });

    it('detects genuine PNG magic bytes', () => {
      expect(detectMimeType(genuinePngBuffer)).toBe('image/png');
      const result = validateFileSignature(genuinePngBuffer, 'image/png');
      expect(result.valid).toBe(true);
    });

    it('detects genuine JPEG magic bytes', () => {
      expect(detectMimeType(genuineJpegBuffer)).toBe('image/jpeg');
      const result = validateFileSignature(genuineJpegBuffer, 'image/jpeg');
      expect(result.valid).toBe(true);
    });

    it('detects genuine GIF magic bytes', () => {
      expect(detectMimeType(genuineGifBuffer)).toBe('image/gif');
      const result = validateFileSignature(genuineGifBuffer, 'image/gif');
      expect(result.valid).toBe(true);
    });

    it('detects genuine plain text and JSON', () => {
      expect(detectMimeType(genuineTextBuffer)).toBe('text/plain');
      expect(detectMimeType(genuineJsonBuffer)).toBe('application/json');
      expect(validateFileSignature(genuineTextBuffer, 'text/plain').valid).toBe(true);
      expect(validateFileSignature(genuineJsonBuffer, 'application/json').valid).toBe(true);
    });

    it('flags executables (MZ and ELF) and rejects them', () => {
      expect(isExecutable(spoofedExeBuffer)).toBe(true);
      expect(isExecutable(spoofedElfBuffer)).toBe(true);

      const exeAsPdf = validateFileSignature(spoofedExeBuffer, 'application/pdf');
      expect(exeAsPdf.valid).toBe(false);
      expect(exeAsPdf.reason).toContain('Executable');

      const elfAsPng = validateFileSignature(spoofedElfBuffer, 'image/png');
      expect(elfAsPng.valid).toBe(false);
      expect(elfAsPng.reason).toContain('Executable');
    });

    it('rejects mismatched MIME types (e.g. PNG bytes claimed as PDF)', () => {
      const result = validateFileSignature(genuinePngBuffer, 'application/pdf');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Spoofed file extension');
    });

    it('rejects binary files containing null bytes declared as text/plain', () => {
      const result = validateFileSignature(spoofedBinaryInText, 'text/plain');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('contains binary data');
    });
  });

  describe('2. Presigned Upload Endpoint (POST /api/v1/uploads/presign)', () => {
    it('returns presigned URL and tenant-isolated key for authenticated user', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/presign')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          filename: 'contract.pdf',
          contentType: 'application/pdf',
          size: 1024 * 50,
          purpose: 'attachment',
        });

      if (res.status !== 200) {
        console.error('ERROR RESPONSE:', res.status, res.body);
      }

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uploadUrl');
      expect(res.body).toHaveProperty('key');
      expect(res.body.expiresIn).toBe(300);

      // Key must strictly start with tenantId/attachment/
      expect(res.body.key).toMatch(new RegExp(`^${tenantAId.toString()}/attachment/`));
      expect(res.body.key).toContain('contract.pdf');

      // URL must have SigV4 parameters
      expect(res.body.uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    });

    it('sanitizes filename to prevent directory traversal in S3 key', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/presign')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          filename: '../../../etc/passwd.png',
          contentType: 'image/png',
          size: 2048,
        });

      expect(res.status).toBe(200);
      expect(res.body.key).not.toContain('..');
      expect(res.body.key).toMatch(new RegExp(`^${tenantAId.toString()}/attachment/`));
    });

    it('rejects unauthenticated upload requests with 401', async () => {
      const res = await request(app).post('/api/v1/uploads/presign').send({
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1000,
      });

      expect(res.status).toBe(401);
    });

    it('rejects files exceeding 50MB with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/presign')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          filename: 'huge_file.zip',
          contentType: 'application/zip',
          size: 51 * 1024 * 1024, // 51MB
        });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('50MB');
    });
  });

  describe('3. Knowledge Base Uploads (POST /api/v1/kb/uploads/presign - RBAC)', () => {
    it('allows OWNER and LEAD to generate KB upload URL', async () => {
      const resOwner = await request(app)
        .post('/api/v1/kb/uploads/presign')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          filename: 'kb_article.pdf',
          contentType: 'application/pdf',
          size: 1024,
        });

      expect(resOwner.status).toBe(200);
      expect(resOwner.body.key).toMatch(new RegExp(`^${tenantAId.toString()}/kb_document/`));

      const resLead = await request(app)
        .post('/api/v1/kb/uploads/presign')
        .set('Authorization', `Bearer ${tokenLeadA}`)
        .send({
          filename: 'faq.md',
          contentType: 'text/markdown',
          size: 512,
        });

      expect(resLead.status).toBe(200);
      expect(resLead.body.key).toMatch(new RegExp(`^${tenantAId.toString()}/kb_document/`));
    });

    it('forbids AGENT from generating KB presigned upload URL with 403', async () => {
      const res = await request(app)
        .post('/api/v1/kb/uploads/presign')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          filename: 'doc.pdf',
          contentType: 'application/pdf',
          size: 1024,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('4. T-FILE-01: Spoofed Extension Rejected via Magic Bytes', () => {
    it('rejects spoofed PE executable disguised as PDF in validate-direct with 400', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/validate-direct')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          data: spoofedExeBuffer.toString('base64'),
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Spoofed File Extension Rejected');
      expect(res.body.detail).toContain('Executable');
    });

    it('accepts genuine PDF buffer in validate-direct with 200', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/validate-direct')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          data: genuinePdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.detectedMime).toBe('application/pdf');
    });

    it('verifies S3 uploaded file and rejects spoofed executable', async () => {
      // Mock S3 GetObject returning spoofed executable bytes
      const mockS3 = {
        send: vi.fn().mockImplementation((command: unknown) => {
          const cmd = command as { constructor: { name: string } };
          if (cmd.constructor.name === 'GetObjectCommand') {
            return Promise.resolve({
              Body: (async function* () {
                yield spoofedExeBuffer;
              })(),
            });
          }
          return Promise.resolve({});
        }),
      } as unknown as S3Client;
      setS3Client(mockS3);

      const res = await request(app)
        .post('/api/v1/uploads/verify')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          key: `${tenantAId.toString()}/attachment/fake_document.pdf`,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Spoofed File Extension Rejected');
    });

    it('verifies S3 uploaded file and accepts genuine PDF', async () => {
      // Mock S3 GetObject returning genuine PDF bytes
      const mockS3 = {
        send: vi.fn().mockImplementation((command: unknown) => {
          const cmd = command as { constructor: { name: string } };
          if (cmd.constructor.name === 'GetObjectCommand') {
            return Promise.resolve({
              Body: (async function* () {
                yield genuinePdfBuffer;
              })(),
            });
          }
          return Promise.resolve({});
        }),
      } as unknown as S3Client;
      setS3Client(mockS3);

      const res = await request(app)
        .post('/api/v1/uploads/verify')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          key: `${tenantAId.toString()}/attachment/real_document.pdf`,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.detectedMime).toBe('application/pdf');
    });

    it('rejects spoofed file when registering KB document (POST /api/v1/kb/documents)', async () => {
      const mockS3 = {
        send: vi.fn().mockImplementation(() =>
          Promise.resolve({
            Body: (async function* () {
              yield spoofedExeBuffer;
            })(),
          }),
        ),
      } as unknown as S3Client;
      setS3Client(mockS3);

      const res = await request(app)
        .post('/api/v1/kb/documents')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          title: 'Company Handbook',
          source: 'upload',
          key: `${tenantAId.toString()}/kb_document/handbook.pdf`,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Spoofed File Extension Rejected');
    });

    it('accepts genuine document when registering KB document (POST /api/v1/kb/documents)', async () => {
      const mockS3 = {
        send: vi.fn().mockImplementation(() =>
          Promise.resolve({
            Body: (async function* () {
              yield genuinePdfBuffer;
            })(),
          }),
        ),
      } as unknown as S3Client;
      setS3Client(mockS3);

      const res = await request(app)
        .post('/api/v1/kb/documents')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          title: 'Company Handbook',
          source: 'upload',
          key: `${tenantAId.toString()}/kb_document/handbook.pdf`,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('PENDING');
      expect(res.body).toHaveProperty('documentId');
    });
  });

  describe('5. Cross-Tenant Storage & Attachment Isolation', () => {
    it('rejects verify request for S3 key belonging to another tenant with 403', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/verify')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          key: `${tenantBId.toString()}/attachment/victim_file.pdf`,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(403);
      expect(res.body.title).toContain('Cross-tenant');
    });

    it('rejects ticket creation with attachments belonging to another tenant with 403', async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          subject: 'Ticket with stolen attachment',
          description: 'Testing cross-tenant attachment injection',
          customerId: customerId.toString(),
          attachments: [
            {
              key: `${tenantBId.toString()}/attachment/stolen.pdf`,
              name: 'stolen.pdf',
              size: 1024,
              mime: 'application/pdf',
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.title).toContain('Cross-tenant');
    });

    it('creates ticket with valid tenant attachments and stores them', async () => {
      let createdDoc: unknown = null;
      vi.spyOn(Counter, 'findOneAndUpdate').mockResolvedValueOnce({ value: 101 } as never);
      vi.spyOn(Ticket, 'create').mockImplementationOnce(((doc: unknown) => {
        createdDoc = {
          ...(doc as Record<string, unknown>),
          _id: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          toObject() {
            return this;
          },
        };
        return Promise.resolve(createdDoc);
      }) as never);

      const validAttachment = {
        key: `${tenantAId.toString()}/attachment/receipt.png`,
        name: 'receipt.png',
        size: 2048,
        mime: 'image/png',
      };

      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          subject: 'Expense Receipt',
          description: 'Please approve receipt attached',
          customerId: customerId.toString(),
          attachments: [validAttachment],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attachments).toHaveLength(1);
      expect(res.body.data.attachments[0].name).toBe('receipt.png');
    });

    it('rejects ticket message with attachments belonging to another tenant with 403', async () => {
      const ticketId = new Types.ObjectId();

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketId.toString()}/messages`)
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          body: 'Here is an attachment from tenant B',
          attachments: [
            {
              key: `${tenantBId.toString()}/attachment/cross.pdf`,
              name: 'cross.pdf',
              size: 1024,
              mime: 'application/pdf',
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.title).toContain('Cross-tenant');
    });

    it('adds ticket message with valid tenant attachment', async () => {
      const ticketId = new Types.ObjectId();

      // Mock finding ticket
      vi.spyOn(Ticket, 'findOne').mockResolvedValueOnce({
        _id: ticketId,
        tenantId: tenantAId,
      } as never);

      // Mock message count and message creation
      vi.spyOn(Message, 'countDocuments').mockResolvedValueOnce(0);
      vi.spyOn(Message, 'create').mockImplementationOnce(((doc: unknown) => {
        return Promise.resolve({
          ...(doc as Record<string, unknown>),
          _id: new Types.ObjectId(),
          createdAt: new Date(),
          toObject() {
            return this;
          },
        });
      }) as never);

      const validAttachment = {
        key: `${tenantAId.toString()}/attachment/invoice.pdf`,
        name: 'invoice.pdf',
        size: 4096,
        mime: 'application/pdf',
      };

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketId.toString()}/messages`)
        .set('Authorization', `Bearer ${tokenAgentA}`)
        .send({
          body: 'Here is the invoice',
          attachments: [validAttachment],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attachments).toHaveLength(1);
      expect(res.body.data.attachments[0].name).toBe('invoice.pdf');
    });
  });
});
