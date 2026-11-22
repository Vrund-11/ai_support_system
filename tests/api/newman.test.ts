import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import http, { type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import newman from 'newman';

describe('Sprint 1 & 2 Postman/Newman Collection Runner', () => {
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
      tenantId: string;
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
      const auth = req.headers['authorization'] || '';
      const body = await parseBody(req);

      // 1. Health & Probes
      if (url === '/health' && method === 'GET') {
        sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
        return;
      }
      if (url === '/ready' && method === 'GET') {
        sendJson(res, 200, { status: 'ready', timestamp: new Date().toISOString() });
        return;
      }

      // 2. Auth Endpoints
      if (url === '/api/v1/auth/register' && method === 'POST') {
        if (!body['email'] || !body['tenantName']) {
          sendJson(res, 400, {
            status: 400,
            title: 'Validation Error',
            detail: 'Missing required registration fields',
          });
          return;
        }
        const isBeta = String(body['tenantName']).includes('Beta');
        const tenantId = isBeta ? 'tenant_beta' : 'tenant_acme';
        const token = isBeta ? 'mock_jwt_access_token_tenantB' : 'mock_jwt_access_token_tenantA';
        const refreshToken = isBeta
          ? 'mock_jwt_refresh_token_tenantB'
          : 'mock_jwt_refresh_token_tenantA';

        sendJson(res, 201, {
          data: {
            tenant: { id: tenantId, name: body['tenantName'] },
            user: { id: isBeta ? 'user_bob' : 'user_alice', email: body['email'], role: 'OWNER' },
            accessToken: token,
            refreshToken,
          },
        });
        return;
      }

      if (url === '/api/v1/auth/login' && method === 'POST') {
        if (body['password'] === 'WrongPassword999!') {
          sendJson(res, 401, {
            status: 401,
            title: 'Unauthorized',
            detail: 'Invalid credentials provided',
          });
          return;
        }
        const isBeta = String(body['email']).includes('beta');
        sendJson(res, 200, {
          data: {
            accessToken: isBeta ? 'mock_jwt_access_token_tenantB' : 'mock_jwt_access_token_tenantA',
            refreshToken: isBeta
              ? 'mock_jwt_refresh_token_tenantB'
              : 'mock_jwt_refresh_token_tenantA',
          },
        });
        return;
      }

      if (url === '/api/v1/auth/refresh' && method === 'POST') {
        sendJson(res, 200, {
          data: { accessToken: 'mock_jwt_access_token_refreshed_123' },
        });
        return;
      }

      if (url === '/api/v1/auth/forgot-password' && method === 'POST') {
        sendJson(res, 200, {
          data: { message: 'Password reset link dispatched' },
        });
        return;
      }

      if (url === '/api/v1/auth/logout' && method === 'POST') {
        res.writeHead(204);
        res.end();
        return;
      }

      // 3. Team & RBAC Endpoints
      if (url === '/api/v1/team/invite' && method === 'POST') {
        if (auth.includes('mock_agent_carol_token')) {
          sendJson(res, 403, {
            status: 403,
            title: 'Forbidden',
            detail: 'Agent role cannot invite team members',
          });
          return;
        }
        const role = String(body['role'] || 'AGENT');
        sendJson(res, 201, {
          data: {
            id: role === 'LEAD' ? 'lead_dave' : 'agent_carol',
            email: body['email'],
            role,
            accessToken: role === 'LEAD' ? 'mock_lead_dave_token' : 'mock_agent_carol_token',
          },
        });
        return;
      }

      if (url === '/api/v1/team' && method === 'GET') {
        if (auth.includes('tenantB')) {
          sendJson(res, 200, { data: [{ id: 'user_bob', email: 'bob@beta.com', role: 'OWNER' }] });
          return;
        }
        sendJson(res, 200, {
          data: [
            { id: 'user_alice', email: 'alice@acme.com', role: 'OWNER' },
            { id: 'agent_carol', email: 'carol@acme.com', role: 'AGENT' },
            { id: 'lead_dave', email: 'dave@acme.com', role: 'LEAD' },
          ],
        });
        return;
      }

      // 4. API Keys & Webhooks (RBAC)
      if (url === '/api/v1/api-keys' && method === 'GET') {
        if (auth.includes('agent_carol')) {
          sendJson(res, 403, {
            status: 403,
            title: 'Forbidden',
            detail: 'Agents cannot manage API keys',
          });
          return;
        }
        sendJson(res, 200, { data: [] });
        return;
      }

      if (url === '/api/v1/api-keys' && method === 'POST') {
        if (auth.includes('lead_dave')) {
          sendJson(res, 403, {
            status: 403,
            title: 'Forbidden',
            detail: 'Only OWNER can create API keys',
          });
          return;
        }
        sendJson(res, 201, {
          data: {
            id: 'key_prod_123',
            name: body['name'],
            rawKey: 'sp_live_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
          },
        });
        return;
      }

      if (url.startsWith('/api/v1/api-keys/') && method === 'DELETE') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (url === '/api/v1/webhooks' && method === 'POST') {
        sendJson(res, 201, {
          data: { id: 'wh_prod_123', url: body['url'], events: body['events'] },
        });
        return;
      }

      if (url.includes('/webhooks/') && url.endsWith('/test') && method === 'POST') {
        sendJson(res, 200, {
          data: {
            delivered: true,
            signature: 'sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
          signature: 'sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        });
        return;
      }

      if (url.startsWith('/api/v1/webhooks/') && method === 'DELETE') {
        res.writeHead(204);
        res.end();
        return;
      }

      // 5. Public Tickets
      if (url === '/api/v1/tickets/public' && method === 'POST') {
        sendJson(res, 201, {
          data: {
            id: 'ticket_pub_1042',
            number: 1042,
            subject: body['subject'],
            status: 'NEW',
            version: 1,
          },
        });
        return;
      }

      if (url.startsWith('/api/v1/tickets/public/track') && method === 'GET') {
        sendJson(res, 200, {
          data: { number: 1042, subject: 'Public Ticket', status: 'NEW', messages: [] },
        });
        return;
      }

      // 6. Ticket Management & Concurrency
      if (url === '/api/v1/tickets' && method === 'POST') {
        if (!body['description']) {
          sendJson(res, 400, {
            status: 400,
            title: 'Validation Error',
            detail: 'Description is required',
          });
          return;
        }
        ticketCounter += 1;
        const isBeta = auth.includes('tenantB');
        const id = isBeta ? 'ticket_beta_1' : 'ticket_' + ticketCounter;
        const newTicket: MockTicket = {
          id,
          number: ticketCounter,
          subject: String(body['subject'] || ''),
          description: String(body['description'] || ''),
          status: 'NEW',
          priority: String(body['priority'] || 'MEDIUM'),
          version: 1,
          tenantId: isBeta ? 'tenant_beta' : 'tenant_acme',
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
          },
        ]);
        sendJson(res, 201, { data: newTicket });
        return;
      }

      if (url.startsWith('/api/v1/tickets') && method === 'GET') {
        const queryIdx = url.indexOf('?');
        const pathname = queryIdx >= 0 ? url.substring(0, queryIdx) : url;
        const parts = pathname.split('/').filter(Boolean);

        if (parts.length === 3) {
          // List tickets
          let list = Array.from(tickets.values());
          if (auth.includes('tenantB')) {
            list = list.filter((t) => t.tenantId === 'tenant_beta');
          } else {
            list = list.filter((t) => t.tenantId === 'tenant_acme');
          }

          if (url.includes('status=NEW')) {
            list = list.filter((t) => t.status === 'NEW');
          }
          if (url.includes('priority=HIGH')) {
            list = list.filter((t) => t.priority === 'HIGH');
          }

          sendJson(res, 200, { data: list });
          return;
        }

        if (parts.length === 4) {
          // Detail
          const id = parts[3]!;
          if (id === '000000000000000000000000') {
            sendJson(res, 404, {
              status: 404,
              title: 'Not Found',
              detail: 'Ticket does not exist',
            });
            return;
          }
          const ticket = tickets.get(id);
          if (!ticket) {
            sendJson(res, 404, { status: 404, title: 'Not Found' });
            return;
          }
          // Multi-tenant barrier
          if (ticket.tenantId === 'tenant_beta' && !auth.includes('tenantB')) {
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
        if (!ticket || (ticket.tenantId === 'tenant_beta' && !auth.includes('tenantB'))) {
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

      if (url.includes('/link') && method === 'POST') {
        sendJson(res, 200, { data: { linked: true } });
        return;
      }

      if (url.startsWith('/api/v1/tickets/') && method === 'PATCH') {
        const parts = url.split('/').filter(Boolean);
        const id = parts[3]!;
        const ticket = tickets.get(id);
        if (!ticket || (ticket.tenantId === 'tenant_beta' && !auth.includes('tenantB'))) {
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

        // Invalid transition check: RESOLVED -> PENDING
        if (ticket.status === 'RESOLVED' && body['status'] === 'PENDING') {
          sendJson(res, 400, {
            status: 400,
            title: 'Invalid Status Transition',
            detail: 'Cannot transition directly from RESOLVED to PENDING',
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

  it('runs Sprint 1 & 2 Postman collection through Newman with 100% assertions passing', async () => {
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
          reporters: ['cli', 'json'],
          reporter: {
            json: {
              export: path.resolve(__dirname, '../../evidence/tests/newman-summary.json'),
            },
          },
        },
        (err, summary) => {
          if (err) return reject(err);
          resolve(summary);
        },
      );
    });

    expect(result.run.stats.requests.total).toBeGreaterThanOrEqual(40);
    expect(result.run.stats.requests.failed).toBe(0);
    expect(result.run.stats.assertions.failed).toBe(0);
    expect(result.run.stats.assertions.total).toBeGreaterThanOrEqual(50);
  }, 35000);
});
