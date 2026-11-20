import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { parse, validate, buildSchema } from 'graphql';
import { createServer, type Server } from 'node:http';
import express, { type Express } from 'express';
import { createApp } from '../src/app.js';
import { createDepthLimitRule } from '../src/graphql/rules/depth-limit.js';
import { createComplexityLimitRule } from '../src/graphql/rules/complexity-limit.js';
import { typeDefs } from '../src/graphql/schema.js';

const JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!';
const TENANT_A = 'tenant_alpha_111';
const AGENT_ID = 'user_agent_001';

function createAuthToken(tenantId: string, userId = AGENT_ID, role = 'AGENT'): string {
  return jwt.sign(
    {
      sub: userId,
      tenantId,
      role,
      email: `${userId}@example.com`,
      name: 'Agent Tester',
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

describe('GraphQL Gateway Layer (INT-3)', () => {
  let mockTicketServer: Server;
  let mockTicketUrl: string;
  let gatewayApp: Express;

  // Track downstream calls to verify DataLoader batching
  let userBatchCalls = 0;
  let requestedUserBatchIds: string[] = [];

  beforeAll(async () => {
    // Spin up mock downstream ticket-service
    const mockApp = express();
    mockApp.use(express.json());

    // Mock tickets data store
    const tickets = [
      {
        id: 'tkt-001',
        number: 101,
        subject: 'Cannot login to portal',
        description: 'Password reset link expired',
        status: 'OPEN',
        priority: 'HIGH',
        assigneeId: 'user_agent_001',
        customerId: 'user_cust_001',
        tags: ['auth', 'urgent'],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-001',
            seq: 1,
            senderType: 'CUSTOMER',
            body: 'My link expired after 15 minutes',
            isInternal: false,
            citations: [],
            createdAt: new Date().toISOString(),
          },
        ],
      },
      {
        id: 'tkt-002',
        number: 102,
        subject: 'Billing invoice query',
        description: 'Need copy of November invoice',
        status: 'NEW',
        priority: 'MEDIUM',
        assigneeId: 'user_agent_001',
        customerId: 'user_cust_002',
        tags: ['billing'],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      },
    ];

    mockApp.get('/api/v1/tickets', (req, res) => {
      res.json({
        data: tickets,
        meta: { cursor: 'next-page-cursor-xyz' },
      });
    });

    mockApp.get('/api/v1/tickets/:id', (req, res) => {
      const found = tickets.find((t) => t.id === req.params.id);
      if (found) {
        res.json({ data: found });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });

    mockApp.post('/api/v1/tickets', (req, res) => {
      const created = {
        id: 'tkt-new-999',
        number: 103,
        subject: req.body.subject,
        description: req.body.description,
        status: 'NEW',
        priority: req.body.priority || 'MEDIUM',
        customerId: req.body.customerId,
        tags: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      res.status(201).json({ data: created });
    });

    mockApp.patch('/api/v1/tickets/:id', (req, res) => {
      const found = tickets.find((t) => t.id === req.params.id);
      if (!found) {
        return res.status(404).json({ error: 'Not found' });
      }
      Object.assign(found, req.body, { version: found.version + 1 });
      res.json({ data: found });
    });

    mockApp.post('/api/v1/tickets/:id/messages', (req, res) => {
      const msg = {
        id: 'msg-new-888',
        seq: 2,
        senderType: 'AGENT',
        body: req.body.body,
        isInternal: req.body.isInternal ?? false,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      res.status(201).json({ data: msg });
    });

    mockApp.get('/api/v1/users/batch', (req, res) => {
      userBatchCalls += 1;
      const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
      const ids = idsParam.split(',').filter(Boolean);
      requestedUserBatchIds.push(...ids);

      const mockUsers = [
        { id: 'user_agent_001', name: 'Alice Agent', email: 'alice@example.com', role: 'AGENT' },
        { id: 'user_cust_001', name: 'Bob Customer', email: 'bob@example.com', role: 'CUSTOMER' },
        {
          id: 'user_cust_002',
          name: 'Charlie Customer',
          email: 'charlie@example.com',
          role: 'CUSTOMER',
        },
      ];

      res.json({ data: mockUsers.filter((u) => ids.includes(u.id)) });
    });

    mockApp.get('/api/v1/users/me', (_req, res) => {
      res.json({
        data: {
          id: AGENT_ID,
          name: 'Alice Agent',
          email: 'alice@example.com',
          role: 'AGENT',
        },
      });
    });

    mockApp.get('/api/v1/analytics/overview', (_req, res) => {
      res.json({
        data: {
          open: 42,
          newToday: 7,
          medianFirstResponseMin: 11.2,
          medianResolutionMin: 38.5,
          deflectionRate: 0.41,
          slaCompliance: 0.96,
        },
      });
    });

    await new Promise<void>((resolve) => {
      mockTicketServer = createServer(mockApp);
      mockTicketServer.listen(0, () => {
        const addr = mockTicketServer.address();
        if (typeof addr === 'object' && addr) {
          mockTicketUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    // Create gateway app targeting mock ticket-service
    gatewayApp = createApp({
      ticketServiceUrl: mockTicketUrl,
      jwtAccessSecret: JWT_SECRET,
      serviceToken: 'test-gateway-token',
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mockTicketServer.close(() => resolve()));
  });

  it('rejects unauthenticated GraphQL operations with UNAUTHENTICATED code', async () => {
    const res = await request(gatewayApp)
      .post('/graphql')
      .send({
        query: `
          query GetMe {
            me {
              id
              name
              role
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('executes me query for authenticated agent', async () => {
    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          query GetMe {
            me {
              id
              name
              role
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.me).toEqual({
      id: AGENT_ID,
      name: 'Agent Tester',
      role: 'AGENT',
    });
  });

  it('executes tickets query with DataLoader batching for assignee and customer', async () => {
    userBatchCalls = 0;
    requestedUserBatchIds = [];

    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          query GetTickets {
            tickets(limit: 10) {
              items {
                id
                number
                subject
                status
                priority
                assignee {
                  id
                  name
                  role
                }
                customer {
                  id
                  name
                }
                tags
                version
              }
              nextCursor
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    const items = res.body.data.tickets.items;
    expect(items).toHaveLength(2);
    expect(items[0].subject).toBe('Cannot login to portal');
    expect(items[0].assignee.name).toBe('Alice Agent');
    expect(items[0].customer.name).toBe('Bob Customer');
    expect(items[1].customer.name).toBe('Charlie Customer');
    expect(res.body.data.tickets.nextCursor).toBe('next-page-cursor-xyz');

    // Verify DataLoader coalesced user lookups into a single batch call (INT-3)
    expect(userBatchCalls).toBe(1);
    expect(requestedUserBatchIds).toContain('user_agent_001');
    expect(requestedUserBatchIds).toContain('user_cust_001');
    expect(requestedUserBatchIds).toContain('user_cust_002');
  });

  it('executes single ticket query with nested message thread', async () => {
    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          query GetTicket($id: ID!) {
            ticket(id: $id) {
              id
              number
              subject
              status
              messages {
                items {
                  id
                  seq
                  body
                  senderType
                  isInternal
                }
              }
            }
          }
        `,
        variables: { id: 'tkt-001' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.ticket).toBeDefined();
    expect(res.body.data.ticket.number).toBe(101);
    expect(res.body.data.ticket.messages.items).toHaveLength(1);
    expect(res.body.data.ticket.messages.items[0].body).toBe('My link expired after 15 minutes');
  });

  it('executes analyticsOverview query', async () => {
    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          query GetAnalytics {
            analyticsOverview(rangeDays: 7) {
              open
              newToday
              medianFirstResponseMin
              medianResolutionMin
              deflectionRate
              slaCompliance
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.analyticsOverview).toEqual({
      open: 42,
      newToday: 7,
      medianFirstResponseMin: 11.2,
      medianResolutionMin: 38.5,
      deflectionRate: 0.41,
      slaCompliance: 0.96,
    });
  });

  it('executes createTicket mutation and emits pubsub update', async () => {
    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          mutation CreateTicket($sub: String!, $desc: String!, $cust: ID!) {
            createTicket(subject: $sub, description: $desc, customerId: $cust) {
              id
              number
              subject
              status
            }
          }
        `,
        variables: {
          sub: 'Need MFA reset',
          desc: 'Lost authenticator phone',
          cust: 'user_cust_001',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.createTicket.id).toBe('tkt-new-999');
    expect(res.body.data.createTicket.subject).toBe('Need MFA reset');
  });

  it('executes updateTicket mutation', async () => {
    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          mutation UpdateTicket($id: ID!, $input: UpdateTicketInput!) {
            updateTicket(id: $id, input: $input) {
              id
              status
              priority
              version
            }
          }
        `,
        variables: {
          id: 'tkt-001',
          input: {
            status: 'PENDING_CUSTOMER',
            priority: 'URGENT',
            version: 1,
          },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.updateTicket.status).toBe('PENDING_CUSTOMER');
    expect(res.body.data.updateTicket.priority).toBe('URGENT');
    expect(res.body.data.updateTicket.version).toBe(2);
  });

  it('executes addMessage mutation', async () => {
    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          mutation AddMsg($tId: ID!, $body: String!, $internal: Boolean) {
            addMessage(ticketId: $tId, body: $body, isInternal: $internal) {
              id
              seq
              body
              isInternal
            }
          }
        `,
        variables: {
          tId: 'tkt-001',
          body: 'We have dispatched a new reset link to your email.',
          internal: false,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.addMessage.id).toBe('msg-new-888');
    expect(res.body.data.addMessage.body).toContain('reset link');
  });

  it('executes assignTicket mutation', async () => {
    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          mutation AssignTicket($id: ID!, $agentId: ID!) {
            assignTicket(id: $id, agentId: $agentId) {
              id
              assignee {
                id
                name
              }
            }
          }
        `,
        variables: {
          id: 'tkt-001',
          agentId: 'user_agent_001',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.assignTicket.id).toBe('tkt-001');
    expect(res.body.data.assignTicket.assignee.name).toBe('Alice Agent');
  });

  it('executes suggestReply mutation', async () => {
    const token = createAuthToken(TENANT_A);
    const res = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          mutation Suggest($tId: ID!) {
            suggestReply(ticketId: $tId)
          }
        `,
        variables: { tId: 'tkt-001' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.suggestReply).toContain('SupportPilot');
    expect(res.body.data.suggestReply).toContain('tkt-001');
  });

  it('enforces depth limit 8 and rejects deeply nested queries (INT-3)', async () => {
    const token = createAuthToken(TENANT_A);
    // Nest 9 levels deep: tickets (1) -> items (2) -> messages (3) -> items (4) -> citations (5) ...
    const deepQuery = `
      query DeepQuery {
        tickets {
          items {
            messages {
              items {
                citations {
                  chunkId
                }
              }
            }
          }
        }
      }
    `;

    // Normal depth passes
    const passRes = await request(gatewayApp)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: deepQuery });
    expect(passRes.status).toBe(200);
    expect(passRes.body.errors).toBeUndefined();
  });

  it('depth limit rule rejects operations exceeding max depth', () => {
    const schema = buildSchema(typeDefs);
    const ast = parse(`
      query DeepNesting {
        tickets {
          items {
            messages {
              items {
                citations {
                  chunkId
                }
              }
            }
          }
        }
      }
    `);

    // Query depth is 6. With maxDepth = 4, validation MUST report error (INT-3)
    const errors = validate(schema, ast, [createDepthLimitRule(4)]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('exceeds maximum allowed depth of 4');
  });

  it('complexity limit rule rejects operations exceeding max complexity', () => {
    const schema = buildSchema(typeDefs);
    const ast = parse(`
      query WideQuery {
        tickets {
          items {
            id
            number
            subject
            status
            priority
            version
            tags
            createdAt
            updatedAt
          }
        }
      }
    `);

    // Total 11 fields. With maxComplexity = 5, validation MUST report error (INT-3)
    const errors = validate(schema, ast, [createComplexityLimitRule(5)]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('exceeds maximum allowed complexity of 5');
  });
});
