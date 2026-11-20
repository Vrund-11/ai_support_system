import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import http, { type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import newman from 'newman';

describe('Sprint 1 Postman/Newman Collection Runner', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    let ticketCounter = 1000;
    let seqCounter = 0;

    interface MockTicket {
      id: string;
      number: number;
      subject: string;
      description: string;
      status: string;
      priority: string;
      version: number;
      tags: string[];
      createdAt: string;
      updatedAt: string;
    }

    interface MockMessage {
      id: string;
      ticketId: string;
      seq: number;
      body: string;
      isInternal: boolean;
      senderType: string;
      createdAt: string;
    }

    const tickets = new Map<string, MockTicket>();
    const messages = new Map<string, MockMessage[]>();
    const timeline = new Map<string, Array<Record<string, unknown>>>();

    async function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
      return new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk: Buffer) => {
          raw += chunk.toString();
        });
        req.on('end', () => {
          try {
            resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
          } catch {
            resolve({});
          }
        });
      });
    }

    function sendJson(res: ServerResponse, status: number, data: unknown) {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    }

    server = http.createServer(async (req, res) => {
      const url = req.url || '';
      const method = req.method || 'GET';
      const body = await parseBody(req);

      if (url === '/health' && method === 'GET') {
        sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
        return;
      }

      if (url === '/api/v1/auth/register' && method === 'POST') {
        sendJson(res, 201, {
          data: {
            tenant: { id: 'tenant_123', name: body['tenantName'] },
            user: { id: 'user_123', email: body['email'], role: 'OWNER' },
            accessToken: 'mock_jwt_access_token_newman_sprint1',
            refreshToken: 'mock_jwt_refresh_token_newman_sprint1',
          },
        });
        return;
      }

      if (url === '/api/v1/auth/login' && method === 'POST') {
        sendJson(res, 200, {
          data: {
            accessToken: 'mock_jwt_access_token_newman_sprint1',
            refreshToken: 'mock_jwt_refresh_token_newman_sprint1',
          },
        });
        return;
      }

      if (url === '/api/v1/auth/logout' && method === 'POST') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (url === '/api/v1/tickets' && method === 'POST') {
        ticketCounter += 1;
        const id = 'ticket_' + ticketCounter;
        const newTicket: MockTicket = {
          id,
          number: ticketCounter,
          subject: String(body['subject'] || ''),
          description: String(body['description'] || ''),
          status: 'NEW',
          priority: String(body['priority'] || 'MEDIUM'),
          version: 1,
          tags: (body['tags'] as string[]) || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        tickets.set(id, newTicket);
        messages.set(id, []);
        timeline.set(id, [
          {
            id: 'evt_' + Date.now(),
            ticketId: id,
            type: 'STATUS',
            payload: { from: null, to: 'NEW' },
            createdAt: new Date().toISOString(),
          },
        ]);
        sendJson(res, 201, { data: newTicket });
        return;
      }

      if (url.startsWith('/api/v1/tickets') && method === 'GET') {
        const parts = url.split('?')[0]!.split('/').filter(Boolean);
        if (parts.length === 3) {
          // GET /api/v1/tickets
          sendJson(res, 200, { data: Array.from(tickets.values()) });
          return;
        }

        if (parts.length === 4) {
          // GET /api/v1/tickets/:id
          const id = parts[3]!;
          const ticket = tickets.get(id);
          if (!ticket) {
            sendJson(res, 404, { status: 404, title: 'Not Found' });
            return;
          }
          sendJson(res, 200, {
            data: {
              ticket,
              messages: messages.get(id) || [],
              timeline: timeline.get(id) || [],
            },
          });
          return;
        }
      }

      if (url.includes('/messages') && method === 'POST') {
        const parts = url.split('/').filter(Boolean);
        const ticketId = parts[3]!;
        const ticket = tickets.get(ticketId);
        if (!ticket) {
          sendJson(res, 404, { status: 404, title: 'Not Found' });
          return;
        }

        seqCounter += 1;
        const msg: MockMessage = {
          id: 'msg_' + seqCounter,
          ticketId,
          seq: seqCounter,
          body: String(body['body'] || ''),
          isInternal: Boolean(body['isInternal']),
          senderType: 'AGENT',
          createdAt: new Date().toISOString(),
        };

        const thread = messages.get(ticketId) || [];
        thread.push(msg);
        messages.set(ticketId, thread);

        sendJson(res, 201, { data: msg });
        return;
      }

      if (url.startsWith('/api/v1/tickets/') && method === 'PATCH') {
        const parts = url.split('/').filter(Boolean);
        const id = parts[3]!;
        const ticket = tickets.get(id);
        if (!ticket) {
          sendJson(res, 404, { status: 404, title: 'Not Found' });
          return;
        }

        const reqVersion = Number(body['version']);
        if (reqVersion !== ticket.version) {
          sendJson(res, 409, {
            status: 409,
            title: 'Version Conflict',
            detail: `Expected version ${ticket.version}, got ${reqVersion}`,
          });
          return;
        }

        ticket.version += 1;
        if (body['status']) ticket.status = String(body['status']);
        if (body['priority']) ticket.priority = String(body['priority']);
        ticket.updatedAt = new Date().toISOString();

        sendJson(res, 200, { data: ticket });
        return;
      }

      sendJson(res, 404, { status: 404, title: 'Not Found' });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('runs Sprint 1 Postman collection through Newman with 100% assertions passing', async () => {
    const collectionPath = path.resolve(__dirname, 'supportpilot-sprint1.collection.json');

    const result = await new Promise<newman.NewmanRunSummary>((resolve, reject) => {
      newman.run(
        {
          collection: collectionPath,
          environment: {
            id: 'test-env',
            name: 'Test Environment',
            values: [
              {
                key: 'baseUrl',
                value: baseUrl,
                enabled: true,
              },
            ],
          },
          reporters: ['cli'],
        },
        (err, summary) => {
          if (err) return reject(err);
          resolve(summary);
        },
      );
    });

    expect(result.run.stats.requests.total).toBeGreaterThanOrEqual(11);
    expect(result.run.stats.requests.failed).toBe(0);
    expect(result.run.stats.assertions.failed).toBe(0);
    expect(result.run.stats.assertions.total).toBeGreaterThanOrEqual(15);
  }, 25000);
});
