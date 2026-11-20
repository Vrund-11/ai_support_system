import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { handler, signPayload, deliverWebhook, type WebhookPayload } from '../index.js';
import type { SQSEvent, SQSRecord } from 'aws-lambda';

describe('AWS Webhook Dispatcher Lambda (INT-2)', () => {
  let targetServer: Server;
  let targetPort: number;
  let receivedRequests: Array<{ headers: http.IncomingHttpHeaders; body: any }> = [];
  let shouldFail = false;

  beforeAll(async () => {
    targetServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        receivedRequests.push({
          headers: req.headers,
          body: data ? JSON.parse(data) : {},
        });

        if (shouldFail) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        }
      });
    });

    await new Promise<void>((resolve) => targetServer.listen(0, resolve));
    targetPort = (targetServer.address() as any).port;
  });

  afterAll(async () => {
    if (targetServer) {
      await new Promise<void>((resolve) => targetServer.close(() => resolve()));
    }
  });

  it('computes deterministic HMAC-SHA256 signature for body', () => {
    const body = JSON.stringify({ ticketId: 't1', status: 'OPEN' });
    const secret = 'my-secret-key-123';
    const sig1 = signPayload(body, secret);
    const sig2 = signPayload(body, secret);

    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64); // SHA-256 hex string is 64 chars
  });

  it('delivers webhook successfully with correct signature and tenant headers', async () => {
    receivedRequests = [];
    shouldFail = false;

    const payload: WebhookPayload = {
      tenantId: 'tenant_org_abc',
      eventId: 'evt_ticket_updated_99',
      event: 'ticket.updated',
      targetUrl: `http://localhost:${targetPort}/webhook`,
      secret: 'whsec_secret_123',
      payload: {
        ticketId: 'tkt_99',
        status: 'RESOLVED',
        resolvedAt: '2026-11-20T12:00:00Z',
      },
    };

    await deliverWebhook(payload);

    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0]!;
    expect(req.headers['x-supportpilot-event']).toBe('ticket.updated');
    expect(req.headers['x-supportpilot-tenant-id']).toBe('tenant_org_abc');
    expect(req.headers['x-supportpilot-delivery']).toBe('evt_ticket_updated_99');
    expect(req.body).toEqual(payload.payload);

    // Verify signature header
    const expectedSig = signPayload(JSON.stringify(payload.payload), 'whsec_secret_123');
    expect(req.headers['x-supportpilot-signature']).toBe(`sha256=${expectedSig}`);
  });

  it('handles SQS event with batch records and reports batchItemFailures on error', async () => {
    receivedRequests = [];
    shouldFail = false;

    const recordSuccess: SQSRecord = {
      messageId: 'msg-success-1',
      receiptHandle: 'handle-1',
      body: JSON.stringify({
        tenantId: 'tenant_a',
        eventId: 'evt-1',
        event: 'ticket.created',
        targetUrl: `http://localhost:${targetPort}/webhook`,
        secret: 'sec-1',
        payload: { id: 1 },
      }),
      attributes: {} as any,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:ap-south-1:123456789012:supportpilot-webhooks',
      awsRegion: 'ap-south-1',
    };

    const recordFail: SQSRecord = {
      messageId: 'msg-failure-2',
      receiptHandle: 'handle-2',
      body: JSON.stringify({
        tenantId: 'tenant_b',
        eventId: 'evt-2',
        event: 'ticket.escalated',
        targetUrl: 'http://localhost:99999/unreachable', // bad port -> network error
        payload: { id: 2 },
      }),
      attributes: {} as any,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:ap-south-1:123456789012:supportpilot-webhooks',
      awsRegion: 'ap-south-1',
    };

    const event: SQSEvent = {
      Records: [recordSuccess, recordFail],
    };

    const result = await handler(event);

    expect(result.batchItemFailures.length).toBe(1);
    expect(result.batchItemFailures[0]!.itemIdentifier).toBe('msg-failure-2');
  });

  it('fails and retries when subscriber endpoint returns 500 status', async () => {
    receivedRequests = [];
    shouldFail = true; // target server returns 500

    const record500: SQSRecord = {
      messageId: 'msg-500-error',
      receiptHandle: 'handle-3',
      body: JSON.stringify({
        tenantId: 'tenant_c',
        eventId: 'evt-3',
        event: 'ticket.closed',
        targetUrl: `http://localhost:${targetPort}/webhook`,
        secret: 'sec-3',
        payload: { id: 3 },
      }),
      attributes: {} as any,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:ap-south-1:123456789012:supportpilot-webhooks',
      awsRegion: 'ap-south-1',
    };

    const result = await handler({ Records: [record500] });

    expect(result.batchItemFailures.length).toBe(1);
    expect(result.batchItemFailures[0]!.itemIdentifier).toBe('msg-500-error');
  });
});
