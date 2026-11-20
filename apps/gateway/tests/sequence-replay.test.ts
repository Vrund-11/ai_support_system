import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import {
  createSocketServer,
  SequenceService,
  type GatewaySocketServer,
  type StoredMessage,
} from '../src/realtime/index.js';

const JWT_SECRET = 'sequence-replay-test-secret-at-least-32-chars!!';

describe('Sequence Numbers & Message Replay on Join (S2-T02 / CHAT-6)', () => {
  let server: Server;
  let socketServer: GatewaySocketServer;
  let serverPort: number;
  let sequenceService: SequenceService;

  beforeAll(async () => {
    const app = createApp({ jwtAccessSecret: JWT_SECRET });
    server = http.createServer(app);

    sequenceService = new SequenceService();
    socketServer = createSocketServer(server, {
      jwtSecret: JWT_SECRET,
      sequenceService,
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

  it('generates strictly monotonic sequence numbers per conversation', async () => {
    const convId = 'conv_seq_test_1';
    const seq1 = await sequenceService.getNextSeq(convId);
    const seq2 = await sequenceService.getNextSeq(convId);
    const seq3 = await sequenceService.getNextSeq(convId);

    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
    expect(seq3).toBe(3);

    // Another conversation starts from 1 independently
    const otherSeq1 = await sequenceService.getNextSeq('conv_seq_test_2');
    expect(otherSeq1).toBe(1);
  });

  it('sends real-time message, increments seq, receives message:ack and broadcasts message:new', async () => {
    const agentToken = jwt.sign(
      { sub: 'agent_401', tenantId: 'tenant_live', role: 'AGENT' },
      JWT_SECRET,
    );
    const visitorToken = 'visitor:tenant_live:visitor_401';

    const agentClient = createClient(agentToken);
    const visitorClient = createClient(visitorToken);

    await Promise.all([
      new Promise<void>((r) => {
        agentClient.on('connect', () => r());
        agentClient.connect();
      }),
      new Promise<void>((r) => {
        visitorClient.on('connect', () => r());
        visitorClient.connect();
      }),
    ]);

    const convId = 'conv_live_chat_1';
    await Promise.all([
      new Promise<void>((r) => {
        agentClient.emit('conversation:join', { conversationId: convId }, () => r());
      }),
      new Promise<void>((r) => {
        visitorClient.emit('conversation:join', { conversationId: convId }, () => r());
      }),
    ]);

    const visitorReceived: StoredMessage[] = [];
    visitorClient.on('message:new', (msg: unknown) => {
      visitorReceived.push(msg as StoredMessage);
    });

    const ackPromise = new Promise<{ clientId: string; seq: number }>((resolve) => {
      agentClient.on('message:ack', (ack) => resolve(ack));
    });

    // Agent sends message
    const sendResult = await new Promise<{ status: string; seq?: number }>((resolve) => {
      agentClient.emit(
        'message:send',
        {
          conversationId: convId,
          clientId: 'client_msg_uuid_101',
          body: 'Hello from agent assist!',
        },
        (res) => resolve(res),
      );
    });

    expect(sendResult.status).toBe('ok');
    expect(sendResult.seq).toBe(1);

    const ack = await ackPromise;
    expect(ack).toEqual({
      clientId: 'client_msg_uuid_101',
      seq: 1,
    });

    await new Promise((r) => setTimeout(r, 80));

    expect(visitorReceived).toHaveLength(1);
    expect(visitorReceived[0]!.body).toBe('Hello from agent assist!');
    expect(visitorReceived[0]!.seq).toBe(1);
    expect(visitorReceived[0]!.senderType).toBe('AGENT');

    agentClient.close();
    visitorClient.close();
  });

  it('deduplicates messages with the same clientId and does not advance sequence counter', async () => {
    const token = jwt.sign(
      { sub: 'agent_dedupe', tenantId: 'tenant_live', role: 'AGENT' },
      JWT_SECRET,
    );
    const client = createClient(token);

    await new Promise<void>((r) => {
      client.on('connect', () => r());
      client.connect();
    });

    const convId = 'conv_dedupe_1';
    await new Promise<void>((r) => {
      client.emit('conversation:join', { conversationId: convId }, () => r());
    });

    // First send
    const res1 = await new Promise<{ status: string; seq?: number }>((resolve) => {
      client.emit(
        'message:send',
        {
          conversationId: convId,
          clientId: 'duplicate_client_id_777',
          body: 'Payment confirmation note',
        },
        (res) => resolve(res),
      );
    });
    expect(res1.status).toBe('ok');
    const firstSeq = res1.seq;

    // Second send with same clientId (e.g. client network retry)
    const res2 = await new Promise<{ status: string; seq?: number }>((resolve) => {
      client.emit(
        'message:send',
        {
          conversationId: convId,
          clientId: 'duplicate_client_id_777',
          body: 'Payment confirmation note',
        },
        (res) => resolve(res),
      );
    });

    expect(res2.status).toBe('ok');
    expect(res2.seq).toBe(firstSeq); // Returned same seq without duplicating

    // Verify messages list only has 1 message
    const allMessages = await sequenceService.getMessagesSince(convId, 0);
    expect(allMessages).toHaveLength(1);

    client.close();
  });

  it('CHAT-6: Disconnect/reconnect message replay guarantees no loss and no duplicates', async () => {
    const convId = 'conv_reconnect_replay_99';
    const visitorToken = 'visitor:tenant_live:customer_alice';
    const agentToken = jwt.sign(
      { sub: 'agent_bob', tenantId: 'tenant_live', role: 'AGENT' },
      JWT_SECRET,
    );

    let customerClient = createClient(visitorToken);
    let agentClient = createClient(agentToken);

    // Both connect & join conversation room
    await Promise.all([
      new Promise<void>((r) => {
        customerClient.on('connect', () => r());
        customerClient.connect();
      }),
      new Promise<void>((r) => {
        agentClient.on('connect', () => r());
        agentClient.connect();
      }),
    ]);

    await Promise.all([
      new Promise<void>((r) => {
        customerClient.emit('conversation:join', { conversationId: convId }, () => r());
      }),
      new Promise<void>((r) => {
        agentClient.emit('conversation:join', { conversationId: convId }, () => r());
      }),
    ]);

    const agentReceivedMessages: StoredMessage[] = [];
    agentClient.on('message:new', (msg: unknown) => {
      agentReceivedMessages.push(msg as StoredMessage);
    });

    // 1. Customer sends Message 1
    await new Promise<void>((resolve) => {
      customerClient.emit(
        'message:send',
        {
          conversationId: convId,
          clientId: 'msg_client_1',
          body: 'Message 1: Hello support',
        },
        () => resolve(),
      );
    });

    // Wait for agent to receive Message 1
    await new Promise((r) => setTimeout(r, 60));
    expect(agentReceivedMessages).toHaveLength(1);
    expect(agentReceivedMessages[0]!.seq).toBe(1);

    // 2. Agent experiences network disconnect / drops socket
    agentClient.disconnect();
    expect(agentClient.connected).toBe(false);

    // 3. While agent is offline, customer sends Message 2 and Message 3
    await new Promise<void>((resolve) => {
      customerClient.emit(
        'message:send',
        {
          conversationId: convId,
          clientId: 'msg_client_2',
          body: 'Message 2: Still waiting for response',
        },
        () => resolve(),
      );
    });

    await new Promise<void>((resolve) => {
      customerClient.emit(
        'message:send',
        {
          conversationId: convId,
          clientId: 'msg_client_3',
          body: 'Message 3: Can someone assist me?',
        },
        () => resolve(),
      );
    });

    // 4. Agent reconnects with a fresh socket connection
    agentClient = createClient(agentToken);

    await new Promise<void>((r) => {
      agentClient.on('connect', () => r());
      agentClient.connect();
    });

    agentClient.on('message:new', (msg: unknown) => {
      agentReceivedMessages.push(msg as StoredMessage);
    });

    // 5. Agent issues conversation:join with lastSeq: 1 (last seen seq before disconnect)
    const replayJoinRes = await new Promise<{ status: string }>((resolve) => {
      agentClient.emit('conversation:join', { conversationId: convId, lastSeq: 1 }, (res) =>
        resolve(res),
      );
    });
    expect(replayJoinRes.status).toBe('ok');

    // Wait for replay events
    await new Promise((r) => setTimeout(r, 80));

    // Agent must have exactly messages 1, 2, and 3 in exact chronological sequence order!
    expect(agentReceivedMessages).toHaveLength(3);
    expect(agentReceivedMessages.map((m) => m.seq)).toEqual([1, 2, 3]);
    expect(agentReceivedMessages[1]!.body).toBe('Message 2: Still waiting for response');
    expect(agentReceivedMessages[2]!.body).toBe('Message 3: Can someone assist me?');

    // Clean up
    customerClient.close();
    agentClient.close();
  });
});
