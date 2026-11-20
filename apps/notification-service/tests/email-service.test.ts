import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { renderEmailTemplate, EmailTransporter, TestMailbox } from '../src/email/index.js';
import { NotificationDispatchers } from '../src/workers.js';
import { MemoryIdempotencyStore } from '../src/idempotency.js';
import { createLogger } from '@supportpilot/shared-lib';
import { createApp } from '../src/app.js';
import { QueueManager } from '../src/manager.js';

describe('Email Service & MailHog SMTP Integration (NOTIF-3, AUTH-4)', () => {
  beforeEach(() => {
    TestMailbox.clear();
  });

  describe('renderEmailTemplate', () => {
    it('renders verify_email template with verification link and expiration', () => {
      const rendered = renderEmailTemplate('verify_email', {
        name: 'Sarah Connor',
        verifyUrl: 'http://localhost:5173/verify-email?token=sec_verify_123',
      });

      expect(rendered.subject).toContain('Verify your email address');
      expect(rendered.html).toContain('Sarah Connor');
      expect(rendered.html).toContain('http://localhost:5173/verify-email?token=sec_verify_123');
      expect(rendered.text).toContain('24 hours');
    });

    it('renders password_reset template with reset link and 1-hour expiration', () => {
      const rendered = renderEmailTemplate('password_reset', {
        name: 'John Doe',
        resetUrl: 'http://localhost:5173/reset-password?token=sec_reset_999',
      });

      expect(rendered.subject).toContain('Reset your password');
      expect(rendered.html).toContain('John Doe');
      expect(rendered.html).toContain('http://localhost:5173/reset-password?token=sec_reset_999');
      expect(rendered.text).toContain('1 hour');
    });

    it('renders ticket_update template with snippet and ticket number', () => {
      const rendered = renderEmailTemplate('ticket_update', {
        name: 'Agent Smith',
        ticketNumber: 1042,
        ticketSubject: 'VPN Connection Failure',
        messageSnippet: 'Please verify gateway IP 10.0.0.1',
      });

      expect(rendered.subject).toBe('[#1042] VPN Connection Failure');
      expect(rendered.html).toContain('Please verify gateway IP 10.0.0.1');
    });

    it('renders sla_alert template with milestone stage', () => {
      const rendered = renderEmailTemplate('sla_alert', {
        ticketNumber: 2001,
        stage: '100_PERCENT',
      });

      expect(rendered.subject).toContain('SLA Alert - 100_PERCENT');
      expect(rendered.html).toContain('2001');
    });
  });

  describe('EmailTransporter', () => {
    it('sends email and records into TestMailbox when SMTP offline or mocked', async () => {
      const transporter = new EmailTransporter({ host: '127.0.0.1', port: 1025 });
      const result = await transporter.send({
        to: 'customer@example.com',
        template: 'password_reset',
        variables: {
          name: 'Customer',
          resetUrl: 'http://localhost:5173/reset?token=abc',
        },
      });

      expect(result.to).toBe('customer@example.com');
      expect(result.subject).toContain('Reset your password');
      expect(TestMailbox.getAll().length).toBe(1);

      const sent = TestMailbox.findLatestFor('customer@example.com');
      expect(sent).toBeDefined();
      expect(sent?.html).toContain('http://localhost:5173/reset?token=abc');
    });
  });

  describe('NotificationDispatchers.processEmail', () => {
    it('dispatches email and honors idempotency key', async () => {
      const store = new MemoryIdempotencyStore();
      const logger = createLogger('email-test', 'silent');
      const dispatchers = new NotificationDispatchers(store, logger);

      const job: any = {
        id: 'job-email-1',
        data: {
          tenantId: 'tenant-123',
          to: 'lead@enterprise.com',
          subject: 'Team Update',
          body: 'Sprint 3 email testing',
          idempotencyKey: 'idemp-email-abc',
        },
      };

      const res1 = await dispatchers.processEmail(job);
      expect(res1.success).toBe(true);
      expect(res1.skipped).toBeFalsy();

      // Second attempt with same idempotency key must be skipped
      const res2 = await dispatchers.processEmail(job);
      expect(res2.success).toBe(true);
      expect(res2.skipped).toBe(true);
      expect(res2.reason).toContain('Duplicate job skipped');
    });
  });

  describe('Email inspection endpoint', () => {
    it('allows querying sent emails by recipient via HTTP API', async () => {
      const qm = new QueueManager({ inMemoryOnly: true });
      const logger = createLogger('email-test', 'silent');
      const app = createApp({ queueManager: qm, logger, serviceToken: 'test-cluster-token' });

      const transporter = new EmailTransporter();
      await transporter.send({
        to: 'auditor@company.org',
        template: 'verify_email',
        variables: { name: 'Auditor', verifyUrl: 'http://localhost:5173/verify?token=audit1' },
      });

      const res = await request(app)
        .get('/api/v1/notifications/email/sent?to=auditor@company.org')
        .set('x-service-token', 'test-cluster-token');

      expect(res.status).toBe(200);
      expect(res.body.emails.length).toBe(1);
      expect(res.body.emails[0].to).toBe('auditor@company.org');
      expect(res.body.emails[0].html).toContain('token=audit1');
    });
  });
});
