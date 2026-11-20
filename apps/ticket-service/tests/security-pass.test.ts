import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { configureAuth } from '../src/services/auth.service.js';
import { Ticket, type ITicketDocument } from '../src/models/ticket.model.js';
import { TicketEvent } from '../src/models/ticket-event.model.js';
import { Message } from '../src/models/message.model.js';

const ACCESS_SECRET = 'sec-pass-access-secret-32-chars!!';
const REFRESH_SECRET = 'sec-pass-refresh-secret-32-chars!';

configureAuth({
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
});

describe('Ticket Service Security Pass (TEN-1..3: Cross-Tenant Isolation & Observability)', () => {
  const app = createApp('silent');

  const tenantAlphaId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantBetaId = new Types.ObjectId('507f1f77bcf86cd799439022');
  const ticketAlphaId = new Types.ObjectId('507f191e810c19729de860aa');
  const ticketBetaId = new Types.ObjectId('507f191e810c19729de860bb');

  function createToken(tenantId: Types.ObjectId, role: string = 'AGENT'): string {
    return jwt.sign(
      { sub: new Types.ObjectId().toString(), tenantId: tenantId.toString(), role },
      ACCESS_SECRET,
      { expiresIn: '15m' },
    );
  }

  const tokenAlpha = createToken(tenantAlphaId);
  const tokenBeta = createToken(tenantBetaId);

  // In-memory collection of tickets
  const ticketsDb = [
    {
      _id: ticketAlphaId,
      id: ticketAlphaId.toString(),
      tenantId: tenantAlphaId,
      number: 101,
      subject: 'Tenant Alpha sensitive ticket',
      description: 'Alpha billing secrets',
      status: 'OPEN',
      priority: 'HIGH',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      toObject() {
        return { ...this };
      },
    },
    {
      _id: ticketBetaId,
      id: ticketBetaId.toString(),
      tenantId: tenantBetaId,
      number: 202,
      subject: 'Tenant Beta sensitive ticket',
      description: 'Beta engineering secrets',
      status: 'OPEN',
      priority: 'URGENT',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      toObject() {
        return { ...this };
      },
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(TicketEvent, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([]) } as any);
    vi.spyOn(Message, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([]) } as any);

    vi.spyOn(Ticket, 'findOne').mockImplementation(((filter: any) => {
      const match = ticketsDb.find((t) => {
        if (filter._id && !t._id.equals(filter._id)) return false;
        if (filter.tenantId && !t.tenantId.equals(filter.tenantId)) return false;
        return true;
      });
      return Promise.resolve(match ? ({ ...match } as unknown as ITicketDocument) : null);
    }) as any);

    vi.spyOn(Ticket, 'find').mockImplementation(((filter: any) => {
      let filtered = ticketsDb.filter((t) => {
        if (filter.tenantId && !t.tenantId.equals(filter.tenantId)) return false;
        if (filter.status && t.status !== filter.status) return false;
        return true;
      });
      return {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((limitCount: number) => {
          filtered = filtered.slice(0, limitCount);
          return Promise.resolve(filtered);
        }),
      } as any;
    }) as any);
  });

  describe('1. Cross-Tenant Data Isolation (TEN-1, TEN-2, TEN-3)', () => {
    it('prevents Tenant Alpha from reading Tenant Beta ticket by ID (returns 404, never data)', async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketBetaId}`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .set('x-tenant-id', tenantAlphaId.toString());

      expect(res.status).toBe(404);
      expect(res.body.data).toBeUndefined();
      expect(res.body.subject).toBeUndefined();
      expect(res.body.description).toBeUndefined();
    });

    it('ensures ticket list queries strictly filter by tenantId, preventing cross-tenant leakage', async () => {
      const resAlpha = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .set('x-tenant-id', tenantAlphaId.toString());

      expect(resAlpha.status).toBe(200);
      expect(resAlpha.body.data).toHaveLength(1);
      expect(resAlpha.body.data[0].subject).toBe('Tenant Alpha sensitive ticket');

      const resBeta = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenBeta}`)
        .set('x-tenant-id', tenantBetaId.toString());

      expect(resBeta.status).toBe(200);
      expect(resBeta.body.data).toHaveLength(1);
      expect(resBeta.body.data[0].subject).toBe('Tenant Beta sensitive ticket');
    });

    it('enforces tenant namespacing on S3 presigned attachment keys', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/presign')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .set('x-tenant-id', tenantAlphaId.toString())
        .send({
          filename: 'report.pdf',
          contentType: 'application/pdf',
          size: 2048,
        });

      expect(res.status).toBe(200);
      expect(res.body.key).toContain(`${tenantAlphaId.toString()}/`);
      expect(res.body.key).not.toContain(tenantBetaId.toString());
    });
  });

  describe('2. Observability & Tracing', () => {
    it('propagates W3C traceparent headers and exposes Prometheus metrics', async () => {
      const traceHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

      const res = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .set('x-tenant-id', tenantAlphaId.toString())
        .set('traceparent', traceHeader);

      expect(res.status).toBe(200);
      expect(res.headers['traceparent']).toBeDefined();
      expect(res.headers['traceparent']).toContain('4bf92f3577b34da6a3ce929d0e0e4736');

      const metricsRes = await request(app).get('/metrics');
      expect(metricsRes.status).toBe(200);
      expect(metricsRes.text).toContain('http_requests_total');
    });
  });
});
