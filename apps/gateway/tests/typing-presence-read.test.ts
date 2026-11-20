import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import {
  createSocketServer,
  PresenceService,
  type GatewaySocketServer,
} from '../src/realtime/index.js';

const JWT_SECRET = 'typing-presence-read-secret-at-least-32-chars!';

describe('Typing Indicators, Presence & Read Receipts (S2-T03 / CHAT-3)', () => {
  let server: Server;
  let socketServer: GatewaySocketServer;
  let serverPort: number;
  let presenceService: PresenceService;

  beforeAll(async () => {
    const app = createApp({ jwtAccessSecret: JWT_SECRET });
    server = http.createServer(app);

    presenceService = new PresenceService();
    socketServer = createSocketServer(server, {
      jwtSecret: JWT_SECRET,
      presenceService,
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

  function createClient(token: string): ClientSocket {
    return Client(`http://127.0.0.1:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    });
  }

  it('broadcasts typing:start and typing:stop to conversation room members except sender', async () => {
    const tokenA = jwt.sign(
      { sub: 'user_alice', tenantId: 'tenant_typing', role: 'AGENT' },
      JWT_SECRET,
    );
    const tokenB = jwt.sign(
      { sub: 'user_bob', tenantId: 'tenant_typing', role: 'AGENT' },
      JWT_SECRET,
    );
    const tokenC = jwt.sign(
      { sub: 'user_charlie', tenantId: 'tenant_typing', role: 'AGENT' },
      JWT_SECRET,
    );

    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);
    const clientC = createClient(tokenC);

    await Promise.all([
      new Promise<void>((r) => {
        clientA.on('connect', () => r());
        clientA.connect();
      }),
      new Promise<void>((r) => {
        clientB.on('connect', () => r());
        clientB.connect();
      }),
      new Promise<void>((r) => {
        clientC.on('connect', () => r());
        clientC.connect();
      }),
    ]);

    // Client A and B join conv_typing_1; Client C joins conv_typing_2
    await Promise.all([
      new Promise<void>((r) => {
        clientA.emit('conversation:join', { conversationId: 'conv_typing_1' }, () => r());
      }),
      new Promise<void>((r) => {
        clientB.emit('conversation:join', { conversationId: 'conv_typing_1' }, () => r());
      }),
      new Promise<void>((r) => {
        clientC.emit('conversation:join', { conversationId: 'conv_typing_2' }, () => r());
      }),
    ]);

    const typingEventsA: unknown[] = [];
    const typingEventsB: Array<{ conversationId: string; who: string; isTyping: boolean }> = [];
    const typingEventsC: unknown[] = [];

    clientA.on('typing', (t) => typingEventsA.push(t));
    clientB.on('typing', (t) => typingEventsB.push(t));
    clientC.on('typing', (t) => typingEventsC.push(t));

    // Client A starts typing
    clientA.emit('typing:start', { conversationId: 'conv_typing_1' });
    await new Promise((r) => setTimeout(r, 60));

    // Client B receives typing indicator from Alice
    expect(typingEventsB).toHaveLength(1);
    expect(typingEventsB[0]).toEqual({
      conversationId: 'conv_typing_1',
      who: 'user_alice',
      isTyping: true,
    });

    // Sender A and other room C do not receive event
    expect(typingEventsA).toHaveLength(0);
    expect(typingEventsC).toHaveLength(0);

    // Client A stops typing
    clientA.emit('typing:stop', { conversationId: 'conv_typing_1' });
    await new Promise((r) => setTimeout(r, 60));

    expect(typingEventsB).toHaveLength(2);
    expect(typingEventsB[1]).toEqual({
      conversationId: 'conv_typing_1',
      who: 'user_alice',
      isTyping: false,
    });

    clientA.close();
    clientB.close();
    clientC.close();
  });

  it('updates online presence when agent connects and disconnects, isolated to tenant', async () => {
    const tokenAgent1 = jwt.sign(
      { sub: 'agent_presence_1', tenantId: 'tenant_pres_A', role: 'AGENT' },
      JWT_SECRET,
    );
    const tokenObserverA = jwt.sign(
      { sub: 'agent_observer_a', tenantId: 'tenant_pres_A', role: 'LEAD' },
      JWT_SECRET,
    );
    const tokenObserverB = jwt.sign(
      { sub: 'agent_observer_b', tenantId: 'tenant_pres_B', role: 'LEAD' },
      JWT_SECRET,
    );

    const observerA = createClient(tokenObserverA);
    const observerB = createClient(tokenObserverB);

    await Promise.all([
      new Promise<void>((r) => {
        observerA.on('connect', () => r());
        observerA.connect();
      }),
      new Promise<void>((r) => {
        observerB.on('connect', () => r());
        observerB.connect();
      }),
    ]);

    const presenceEventsA: Array<{ userId: string; status: 'online' | 'offline' }> = [];
    const presenceEventsB: Array<{ userId: string; status: 'online' | 'offline' }> = [];

    observerA.on('presence:update', (p) => presenceEventsA.push(p));
    observerB.on('presence:update', (p) => presenceEventsB.push(p));

    // Agent 1 connects to tenant A
    const agent1 = createClient(tokenAgent1);
    await new Promise<void>((r) => {
      agent1.on('connect', () => r());
      agent1.connect();
    });

    await new Promise((r) => setTimeout(r, 60));

    // Observer A in same tenant receives 'online' update
    expect(presenceEventsA).toEqual([{ userId: 'agent_presence_1', status: 'online' }]);
    // Observer B in tenant B receives nothing (cross-tenant isolation)
    expect(presenceEventsB).toHaveLength(0);

    // Agent 1 disconnects
    agent1.disconnect();
    await new Promise((r) => setTimeout(r, 60));

    // Observer A receives 'offline' update
    expect(presenceEventsA).toHaveLength(2);
    expect(presenceEventsA[1]).toEqual({ userId: 'agent_presence_1', status: 'offline' });
    expect(presenceEventsB).toHaveLength(0);

    observerA.close();
    observerB.close();
  });

  it('records and broadcasts message read receipts with upToSeq', async () => {
    const token = jwt.sign(
      { sub: 'customer_reader', tenantId: 'tenant_read', role: 'AGENT' },
      JWT_SECRET,
    );
    const client = createClient(token);

    await new Promise<void>((r) => {
      client.on('connect', () => r());
      client.connect();
    });

    const convId = 'conv_read_receipt_1';
    await new Promise<void>((r) => {
      client.emit('conversation:join', { conversationId: convId }, () => r());
    });

    const readReceipts: Array<{ conversationId: string; userId: string; upToSeq: number }> = [];
    client.on('message:read', (receipt) => readReceipts.push(receipt));

    // Emit read receipt up to seq 12
    client.emit('message:read', { conversationId: convId, upToSeq: 12 });

    await new Promise((r) => setTimeout(r, 60));

    expect(readReceipts).toHaveLength(1);
    expect(readReceipts[0]).toEqual({
      conversationId: convId,
      userId: 'customer_reader',
      upToSeq: 12,
    });

    // Check presence service persisted the read receipt
    const latestRead = await presenceService.getLatestReadSeq(convId, 'customer_reader');
    expect(latestRead).toBe(12);

    client.close();
  });
});
