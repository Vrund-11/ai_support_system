import nodemailer, { type Transporter } from 'nodemailer';
import { renderEmailTemplate } from './templates.js';

export interface SentEmailRecord {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  template?: string;
  sentAt: string;
  source: 'smtp' | 'test_mailbox';
}

class TestMailboxStore {
  private sent: SentEmailRecord[] = [];

  record(email: SentEmailRecord): void {
    this.sent.push(email);
  }

  getAll(): SentEmailRecord[] {
    return [...this.sent];
  }

  findByRecipient(to: string): SentEmailRecord[] {
    return this.sent.filter((e) => e.to.toLowerCase() === to.toLowerCase());
  }

  findLatestFor(to: string): SentEmailRecord | undefined {
    const list = this.findByRecipient(to);
    return list[list.length - 1];
  }

  clear(): void {
    this.sent = [];
  }
}

export const TestMailbox = new TestMailboxStore();

export interface EmailOptions {
  to: string;
  subject?: string;
  body?: string;
  template?: string;
  variables?: Record<string, unknown>;
  from?: string;
}

export interface SendEmailResult {
  messageId: string;
  to: string;
  subject: string;
  sentAt: string;
  deliveredVia: 'smtp' | 'test_mailbox';
}

export class EmailTransporter {
  private transporter: Transporter | null = null;
  private defaultFrom: string;
  private host: string;
  private port: number;

  constructor(options: { host?: string; port?: number; from?: string } = {}) {
    this.host = options.host || process.env['SMTP_HOST'] || 'localhost';
    this.port = Number(options.port || process.env['SMTP_PORT'] || 1025);
    this.defaultFrom =
      options.from || process.env['EMAIL_FROM'] || 'SupportPilot <notifications@supportpilot.io>';
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: false,
        ignoreTLS: true,
      });
    }
    return this.transporter;
  }

  async send(options: EmailOptions): Promise<SendEmailResult> {
    let subject = options.subject || 'SupportPilot Notification';
    let html = `<p>${options.body || ''}</p>`;
    let text = options.body || '';

    if (options.template) {
      const rendered = renderEmailTemplate(options.template, {
        ...options.variables,
        subject: options.subject,
        body: options.body,
      });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    const from = options.from || this.defaultFrom;
    const sentAt = new Date().toISOString();
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const record: SentEmailRecord = {
      id: messageId,
      to: options.to,
      from,
      subject,
      html,
      text,
      template: options.template,
      sentAt,
      source: 'test_mailbox',
    };

    try {
      const transport = this.getTransporter();
      await transport.sendMail({
        from,
        to: options.to,
        subject,
        html,
        text,
      });
      record.source = 'smtp';
      TestMailbox.record(record);

      return {
        messageId,
        to: options.to,
        subject,
        sentAt,
        deliveredVia: 'smtp',
      };
    } catch {
      // SMTP offline or test environment -> safely fallback to test mailbox
      record.source = 'test_mailbox';
      TestMailbox.record(record);

      return {
        messageId,
        to: options.to,
        subject,
        sentAt,
        deliveredVia: 'test_mailbox',
      };
    }
  }
}

let defaultEmailTransporter: EmailTransporter | null = null;

export function getEmailTransporter(): EmailTransporter {
  if (!defaultEmailTransporter) {
    defaultEmailTransporter = new EmailTransporter();
  }
  return defaultEmailTransporter;
}
