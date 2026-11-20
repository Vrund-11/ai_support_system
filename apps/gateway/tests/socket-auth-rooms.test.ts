import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import {
  createSocketServer,
  tenantRoom,
  userRoom,
  conversationRoom,
  type GatewaySocketServer,
} from '../src/realtime/index.js';

const JWT_SECRET = 'test-secret-at-least-32-chars-for-gateway!!';

describe('Gateway Socket.IO Handshake Auth & Rooms (S2-T01)', () => {
  let server: Server;
  let socketServer: GatewaySocketServer;
  let serverPort: number;

  beforeAll(async () => {
    const app = createApp({ jwtAccessSecret: JWT_SECRET });
    server = http.createServer(app);

    socketServer = createSocketServer(server, {
      jwtSecret: JWT_SECRET,
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    socketServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function createClient(token?: string, extraAuth?: Record<string, unknown>): ClientSocket {
    return Client(`http://127.0.0.1:${serverPort}`, {
      auth: token ? { token, ...extraAuth } : extraAuth,
      transports: ['websocket'],
      autoConnect: false,
    });
  }

  it('rejects connection when token is missing', async () => {
    const client = createClient();

    const error = await new Promise<Error>((resolve) => {
      client.on('connect_error', (err) => resolve(err));
      client.connect();
    });

    expect(error.message).toContain('Authentication error: token missing');
    client.close();
  });

  it('rejects connection when JWT token is invalid or corrupted', async () => {
    const client = createClient('corrupted.jwt.token');

    const error = await new Promise<Error>((resolve) => {
      client.on('connect_error', (err) => resolve(err));
      client.connect();
    });

    expect(error.message).toContain('Authentication error: token invalid or expired');
    client.close();
  });

  it('rejects connection when JWT is missing tenantId', async () => {
    const invalidToken = jwt.sign({ sub: 'user_1', role: 'AGENT' }, JWT_SECRET);
    const client = createClient(invalidToken);

    const error = await new Promise<Error>((resolve) => {
      client.on('connect_error', (err) => resolve(err));
      client.connect();
    });

    expect(error.message).toContain('Authentication error: missing tenantId in token');
    client.close();
  });

  it('authenticates valid agent JWT, attaches user data, and joins tenant and user rooms', async () => {
    const token = jwt.sign(
      { sub: 'agent_100', tenantId: 'tenant_alpha', role: 'AGENT', email: 'agent@alpha.com' },
      JWT_SECRET,
    );

    const client = createClient(token);

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err) => reject(err));
      client.connect();
    });

    expect(client.connected).toBe(true);

    // Verify rooms on server
    const serverSockets = Array.from(socketServer.sockets.sockets.values());
    const matchedSocket = serverSockets.find((s) => s.data.user?.id === 'agent_100');

    expect(matchedSocket).toBeDefined();
    expect(matchedSocket!.data.user).toEqual({
      id: 'agent_100',
      tenantId: 'tenant_alpha',
      role: 'AGENT',
      isVisitor: false,
      email: 'agent@alpha.com',
    });

    expect(matchedSocket!.rooms.has(tenantRoom('tenant_alpha'))).toBe(true);
    expect(matchedSocket!.rooms.has(userRoom('agent_100'))).toBe(true);

    client.close();
  });

  it('authenticates formatted visitor token, joins user room, and does NOT join tenant room', async () => {
    const visitorToken = 'visitor:tenant_alpha:vis_777';
    const client = createClient(visitorToken);

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err) => reject(err));
      client.connect();
    });

    expect(client.connected).toBe(true);

    const serverSockets = Array.from(socketServer.sockets.sockets.values());
    const matchedSocket = serverSockets.find((s) => s.data.user?.id === 'vis_777');

    expect(matchedSocket).toBeDefined();
    expect(matchedSocket!.data.user).toEqual({
      id: 'vis_777',
      tenantId: 'tenant_alpha',
      role: 'VISITOR',
      isVisitor: true,
    });

    // Visitor must have user room but NEVER tenant room
    expect(matchedSocket!.rooms.has(userRoom('vis_777'))).toBe(true);
    expect(matchedSocket!.rooms.has(tenantRoom('tenant_alpha'))).toBe(false);

    client.close();
  });

  it('authenticates signed visitor JWT', async () => {
    const visitorJwt = jwt.sign(
      { visitorId: 'vis_signed_888', tenantId: 'tenant_alpha', type: 'VISITOR' },
      JWT_SECRET,
    );

    const client = createClient(visitorJwt);

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err) => reject(err));
      client.connect();
    });

    expect(client.connected).toBe(true);

    const serverSockets = Array.from(socketServer.sockets.sockets.values());
    const matchedSocket = serverSockets.find((s) => s.data.user?.id === 'vis_signed_888');

    expect(matchedSocket).toBeDefined();
    expect(matchedSocket!.data.user.isVisitor).toBe(true);
    expect(matchedSocket!.rooms.has(tenantRoom('tenant_alpha'))).toBe(false);

    client.close();
  });

  it('allows clients to join and leave conversation rooms', async () => {
    const token = jwt.sign(
      { sub: 'agent_join_test', tenantId: 'tenant_alpha', role: 'AGENT' },
      JWT_SECRET,
    );
    const client = createClient(token);

    await new Promise<void>((resolve) => {
      client.on('connect', () => resolve());
      client.connect();
    });

    // Join conversation
    const joinRes = await new Promise<{ status: string }>((resolve) => {
      client.emit('conversation:join', { conversationId: 'conv_42' }, (res) => resolve(res));
    });
    expect(joinRes.status).toBe('ok');

    const serverSockets = Array.from(socketServer.sockets.sockets.values());
    const matched = serverSockets.find((s) => s.data.user?.id === 'agent_join_test');
    expect(matched!.rooms.has(conversationRoom('conv_42'))).toBe(true);

    // Leave conversation
    const leaveRes = await new Promise<{ status: string }>((resolve) => {
      client.emit('conversation:leave', { conversationId: 'conv_42' }, (res) => resolve(res));
    });
    expect(leaveRes.status).toBe('ok');
    expect(matched!.rooms.has(conversationRoom('conv_42'))).toBe(false);

    client.close();
  });

  it('enforces room broadcast isolation between different conversation rooms', async () => {
    const token1 = jwt.sign(
      { sub: 'user_conv_1', tenantId: 'tenant_alpha', role: 'AGENT' },
      JWT_SECRET,
    );
    const token2 = jwt.sign(
      { sub: 'user_conv_2', tenantId: 'tenant_alpha', role: 'AGENT' },
      JWT_SECRET,
    );

    const client1 = createClient(token1);
    const client2 = createClient(token2);

    await Promise.all([
      new Promise<void>((resolve) => {
        client1.on('connect', () => resolve());
        client1.connect();
      }),
      new Promise<void>((resolve) => {
        client2.on('connect', () => resolve());
        client2.connect();
      }),
    ]);

    // Client 1 joins room conv_A, Client 2 joins room conv_B
    await new Promise<void>((resolve) => {
      client1.emit('conversation:join', { conversationId: 'conv_A' }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      client2.emit('conversation:join', { conversationId: 'conv_B' }, () => resolve());
    });

    const client1Received: unknown[] = [];
    const client2Received: unknown[] = [];

    client1.on('message:new', (msg) => client1Received.push(msg));
    client2.on('message:new', (msg) => client2Received.push(msg));

    // Server broadcasts only to conv_A
    socketServer.to(conversationRoom('conv_A')).emit('message:new', { text: 'Hello Room A' });

    // Allow network event loop tick
    await new Promise((r) => setTimeout(r, 80));

    expect(client1Received).toEqual([{ text: 'Hello Room A' }]);
    expect(client2Received).toHaveLength(0);

    client1.close();
    client2.close();
  });

  it('enforces tenant isolation across tenant rooms', async () => {
    const tokenTenantA = jwt.sign(
      { sub: 'agent_tenant_a', tenantId: 'tenant_AAA', role: 'AGENT' },
      JWT_SECRET,
    );
    const tokenTenantB = jwt.sign(
      { sub: 'agent_tenant_b', tenantId: 'tenant_BBB', role: 'AGENT' },
      JWT_SECRET,
    );

    const clientA = createClient(tokenTenantA);
    const clientB = createClient(tokenTenantB);

    await Promise.all([
      new Promise<void>((resolve) => {
        clientA.on('connect', () => resolve());
        clientA.connect();
      }),
      new Promise<void>((resolve) => {
        clientB.on('connect', () => resolve());
        clientB.connect();
      }),
    ]);

    const clientAReceived: unknown[] = [];
    const clientBReceived: unknown[] = [];

    clientA.on('ticket:updated', (evt) => clientAReceived.push(evt));
    clientB.on('ticket:updated', (evt) => clientBReceived.push(evt));

    // Broadcast only to tenant_AAA room
    socketServer.to(tenantRoom('tenant_AAA')).emit('ticket:updated', { id: 'ticket_aaa_1' });

    await new Promise((r) => setTimeout(r, 80));

    expect(clientAReceived).toEqual([{ id: 'ticket_aaa_1' }]);
    expect(clientBReceived).toHaveLength(0); // Zero cross-tenant leakage

    clientA.close();
    clientB.close();
  });
});
