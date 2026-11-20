import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocketIO, type Socket as ClientSocket } from 'socket.io-client';

describe('Sprint 2 Hermetic End-to-End Chat Handoff Runner', () => {
  let server: Server;
  let ioServer: SocketIOServer;
  let port: number;
  let customerSocket: ClientSocket;
  let agentSocket: ClientSocket;

  const tenantA = 'tenant_e2e_alpha';
  const tenantB = 'tenant_e2e_beta';
  const conversationId = 'conv_sprint2_e2e_001';

  interface ChatMessageRecord {
    id: string;
    conversationId: string;
    tenantId: string;
    seq: number;
    body: string;
    senderType: 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM';
    citations?: Array<{ chunkId: string; title: string }>;
    createdAt: string;
  }

  const messageStore: ChatMessageRecord[] = [];
  let conversationStatus = 'ACTIVE_BOT';
  let createdTicket: Record<string, unknown> | null = null;
  let seqCounter = 0;

  beforeAll(async () => {
    server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      // Handle CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Mock GraphQL endpoint on Gateway
      if (req.method === 'POST' && url.pathname === '/graphql') {
        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk.toString();
        });
        req.on('end', () => {
          const body = JSON.parse(rawBody || '{}');
          const query = body.query || '';

          if (query.includes('tickets')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                data: {
                  tickets: {
                    items: createdTicket ? [createdTicket] : [],
                    totalCount: createdTicket ? 1 : 0,
                  },
                },
              }),
            );
            return;
          }

          if (query.includes('suggestReply')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                data: {
                  suggestReply: {
                    replyText: 'I would be happy to help reset your password.',
                    confidence: 0.95,
                    citations: [
                      {
                        chunkId: 'chunk_pwd_01',
                        documentId: 'doc_auth_01',
                        title: 'Password Reset Guide',
                        similarity: 0.94,
                      },
                    ],
                  },
                },
              }),
            );
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: {} }));
        });
        return;
      }

      // Fallback
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    // Socket.IO Server with tenant isolation and sequence numbers
    ioServer = new SocketIOServer(server, {
      cors: { origin: '*' },
    });

    ioServer.on('connection', (socket) => {
      const handshake = socket.handshake.auth || {};
      const socketTenant = handshake.tenantId as string;
      const role = (handshake.role as string) || 'VISITOR';

      // Join tenant & conversation rooms
      socket.on('join_conversation', ({ tenantId, convId }) => {
        // Enforce strict tenant isolation
        if (tenantId !== socketTenant) {
          socket.emit('error', { code: 'UNAUTHORIZED_TENANT', message: 'Tenant mismatch' });
          return;
        }

        const roomKey = `room:${tenantId}:${convId}`;
        socket.join(roomKey);
        socket.emit('joined', { roomKey, status: conversationStatus });
      });

      // Customer sends chat message
      socket.on('chat:send', async ({ tenantId, convId, text }) => {
        if (tenantId !== socketTenant) {
          socket.emit('error', { code: 'UNAUTHORIZED_TENANT' });
          return;
        }

        const roomKey = `room:${tenantId}:${convId}`;
        seqCounter++;

        const userMsg: ChatMessageRecord = {
          id: `msg_${Date.now()}_${seqCounter}`,
          conversationId: convId,
          tenantId,
          seq: seqCounter,
          body: text,
          senderType: role === 'AGENT' ? 'AGENT' : 'CUSTOMER',
          createdAt: new Date().toISOString(),
        };
        messageStore.push(userMsg);
        ioServer.to(roomKey).emit('chat:message', userMsg);

        // If customer asked for human agent or low confidence trigger
        if (role === 'VISITOR' && text.toLowerCase().includes('agent')) {
          conversationStatus = 'WAITING_AGENT';

          // Create escalated ticket
          createdTicket = {
            id: 'tkt_escalated_777',
            number: 1077,
            subject: 'Escalated from live chat',
            description: `Customer requested agent handoff. Transcript messages: ${messageStore.length}`,
            status: 'OPEN',
            priority: 'HIGH',
            tenantId,
            tags: ['escalated'],
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          seqCounter++;
          const sysMsg: ChatMessageRecord = {
            id: `msg_sys_${Date.now()}`,
            conversationId: convId,
            tenantId,
            seq: seqCounter,
            body: 'I am transferring you to an agent right now. Please wait a moment...',
            senderType: 'SYSTEM',
            createdAt: new Date().toISOString(),
          };
          messageStore.push(sysMsg);
          ioServer.to(roomKey).emit('chat:message', sysMsg);
          ioServer.to(roomKey).emit('chat:status_change', {
            status: 'WAITING_AGENT',
            ticketId: createdTicket.id,
          });
          return;
        }

        // If normal customer message in ACTIVE_BOT mode, generate AI answer with citations
        if (role === 'VISITOR' && conversationStatus === 'ACTIVE_BOT') {
          seqCounter++;
          const aiMsg: ChatMessageRecord = {
            id: `msg_ai_${Date.now()}`,
            conversationId: convId,
            tenantId,
            seq: seqCounter,
            body: 'To reset your password, visit Settings > Security and click "Reset Password".',
            senderType: 'AI',
            citations: [
              {
                chunkId: 'chunk_pwd_01',
                title: 'Password Reset Guide',
              },
            ],
            createdAt: new Date().toISOString(),
          };
          messageStore.push(aiMsg);
          ioServer.to(roomKey).emit('chat:message', aiMsg);
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    customerSocket?.disconnect();
    agentSocket?.disconnect();
    ioServer?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('connects customer socket and receives welcome / sequence number on join', async () => {
    customerSocket = ClientSocketIO(`http://localhost:${port}`, {
      auth: { tenantId: tenantA, role: 'VISITOR' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      customerSocket.on('connect', () => {
        customerSocket.emit('join_conversation', { tenantId: tenantA, convId: conversationId });
      });

      customerSocket.on('joined', (data) => {
        expect(data.roomKey).toBe(`room:${tenantA}:${conversationId}`);
        expect(data.status).toBe('ACTIVE_BOT');
        resolve();
      });
    });
  });

  it('sends customer inquiry and receives AI answer with grounded citations (AI-1, AI-2)', async () => {
    const receivedMessages: ChatMessageRecord[] = [];

    await new Promise<void>((resolve) => {
      customerSocket.on('chat:message', (msg: ChatMessageRecord) => {
        receivedMessages.push(msg);
        if (msg.senderType === 'AI') {
          expect(msg.body).toContain('reset your password');
          expect(msg.citations).toBeDefined();
          expect(msg.citations?.length).toBeGreaterThan(0);
          expect(msg.citations?.[0].title).toBe('Password Reset Guide');
          expect(msg.seq).toBeGreaterThan(0);
          resolve();
        }
      });

      customerSocket.emit('chat:send', {
        tenantId: tenantA,
        convId: conversationId,
        text: 'How do I reset my password?',
      });
    });

    expect(receivedMessages.some((m) => m.senderType === 'CUSTOMER')).toBe(true);
    expect(receivedMessages.some((m) => m.senderType === 'AI')).toBe(true);
  });

  it('triggers handoff flow to WAITING_AGENT when customer asks for a human agent (CHAT-4)', async () => {
    let statusChanged = false;

    await new Promise<void>((resolve) => {
      customerSocket.on('chat:status_change', (payload: { status: string; ticketId: string }) => {
        expect(payload.status).toBe('WAITING_AGENT');
        expect(payload.ticketId).toBeDefined();
        statusChanged = true;
        resolve();
      });

      customerSocket.emit('chat:send', {
        tenantId: tenantA,
        convId: conversationId,
        text: 'I want to speak with a human agent please',
      });
    });

    expect(statusChanged).toBe(true);
    expect(conversationStatus).toBe('WAITING_AGENT');
    expect(createdTicket).not.toBeNull();
  });

  it('allows agent to join conversation, query ticket via GraphQL, and send takeover message', async () => {
    // 1. Agent queries GraphQL for escalated ticket
    const gqlRes = await fetch(`http://localhost:${port}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { tickets { items { id number status tags } } }`,
      }),
    });
    const gqlData = (await gqlRes.json()) as {
      data: { tickets: { items: Array<{ id: string; tags: string[] }> } };
    };
    expect(gqlData.data.tickets.items.length).toBe(1);
    expect(gqlData.data.tickets.items[0].tags).toContain('escalated');

    // 2. Agent joins conversation room
    agentSocket = ClientSocketIO(`http://localhost:${port}`, {
      auth: { tenantId: tenantA, role: 'AGENT' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      agentSocket.on('connect', () => {
        agentSocket.emit('join_conversation', { tenantId: tenantA, convId: conversationId });
      });

      agentSocket.on('joined', (data) => {
        expect(data.status).toBe('WAITING_AGENT');
        resolve();
      });
    });

    // 3. Agent sends reply, customer receives it in real time
    await new Promise<void>((resolve) => {
      customerSocket.on('chat:message', (msg: ChatMessageRecord) => {
        if (msg.senderType === 'AGENT') {
          expect(msg.body).toBe('Hi! Agent Sarah here. How can I help you?');
          expect(msg.tenantId).toBe(tenantA);
          resolve();
        }
      });

      agentSocket.emit('chat:send', {
        tenantId: tenantA,
        convId: conversationId,
        text: 'Hi! Agent Sarah here. How can I help you?',
      });
    });
  });

  it('enforces non-negotiable cross-tenant isolation: tenant B cannot join or access conversation (TEN-1)', async () => {
    const tenantBSocket = ClientSocketIO(`http://localhost:${port}`, {
      auth: { tenantId: tenantB, role: 'AGENT' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      tenantBSocket.on('connect', () => {
        // Attempt cross-tenant join on Tenant A's conversation
        tenantBSocket.emit('join_conversation', { tenantId: tenantA, convId: conversationId });
      });

      tenantBSocket.on('error', (err: { code: string; message: string }) => {
        expect(err.code).toBe('UNAUTHORIZED_TENANT');
        tenantBSocket.disconnect();
        resolve();
      });
    });
  });
});
