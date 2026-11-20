import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import {
  createSocketServer,
  HandoffService,
  type GatewaySocketServer,
  type TicketCreatePayload,
} from '../src/realtime/index.js';

const JWT_SECRET = 'test-secret-at-least-32-chars-for-gateway!!';

describe('Live Chat Handoff Flow (CHAT-4 / S2-T10)', () => {
  let server: Server;
  let socketServer: GatewaySocketServer;
  let serverPort: number;
  let handoffService: HandoffService;

  const createdTickets: TicketCreatePayload[] = [];
  let aiShouldEscalate = false;
  let aiConfidence = 0.95;
  let aiAnswerText = 'AI synthesized response';

  beforeAll(async () => {
    const app = createApp({ jwtAccessSecret: JWT_SECRET });
    server = http.createServer(app);

    handoffService = new HandoffService({
      ticketCreator: async (payload) => {
        createdTickets.push(payload);
        return {
          id: `tkt_${createdTickets.length}`,
          number: 100 + createdTickets.length,
        };
      },
      aiAnswerProvider: async () => {
        return {
          answer: aiAnswerText,
          citations: [{ chunk_id: 'c1', doc_id: 'd1', title: 'Guide' }],
          confidence: aiConfidence,
          should_escalate: aiShouldEscalate,
          reason: aiShouldEscalate ? 'Confidence below threshold' : undefined,
        };
      },
    });

    socketServer = createSocketServer(server, {
      jwtSecret: JWT_SECRET,
      handoffService,
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

  function makeAgentToken(tenantId: string, userId: string): string {
    return jwt.sign(
      {
        sub: userId,
        tenantId,
        role: 'AGENT',
        email: `${userId}@company.com`,
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
  }

  it('triggers handoff and creates ticket when customer requests human agent', async () => {
    createdTickets.length = 0;
    const tenantId = 'tenant_handoff_1';
    const conversationId = 'conv_human_req_1';

    // Agent client listens for handoff:escalated on tenant room
    const agentToken = makeAgentToken(tenantId, 'agent_1');
    const agentClient = createClient(agentToken);
    await new Promise<void>((res) => {
      agentClient.on('connect', () => res());
      agentClient.connect();
    });

    const agentHandoffPromise = new Promise<{
      conversationId: string;
      tenantId: string;
      ticketId: string;
      ticketNumber?: number;
      reason: string;
    }>((res) => {
      agentClient.on('handoff:escalated', (data) => res(data));
    });

    // Visitor client in conversation room
    const visitorClient = createClient(`visitor:${tenantId}:visitor_1`);
    await new Promise<void>((res) => {
      visitorClient.on('connect', () => res());
      visitorClient.connect();
    });

    await new Promise<void>((res) => {
      visitorClient.emit('conversation:join', { conversationId }, () => res());
    });

    const stateChangePromise = new Promise<{
      conversationId: string;
      state: string;
      ticketId?: string;
      ticketNumber?: number;
    }>((res) => {
      visitorClient.on('conversation:state', (data) => res(data));
    });

    const systemMsgPromise = new Promise<{
      body: string;
      senderType: string;
    }>((res) => {
      visitorClient.on('message:new', (msg: any) => {
        if (msg.senderType === 'SYSTEM') res(msg);
      });
    });

    // First greeting message
    await new Promise<void>((res) => {
      visitorClient.emit(
        'message:send',
        { conversationId, clientId: 'c1', body: 'Hello there' },
        () => res(),
      );
    });

    // Customer requests a human agent
    await new Promise<void>((res) => {
      visitorClient.emit(
        'message:send',
        {
          conversationId,
          clientId: 'c2',
          body: 'I need to speak to a human representative please',
        },
        () => res(),
      );
    });

    // Verify state transition to WAITING_AGENT
    const stateData = await stateChangePromise;
    expect(stateData.conversationId).toBe(conversationId);
    expect(stateData.state).toBe('WAITING_AGENT');
    expect(stateData.ticketNumber).toBeDefined();

    // Verify agent notification
    const handoffData = await agentHandoffPromise;
    expect(handoffData.conversationId).toBe(conversationId);
    expect(handoffData.tenantId).toBe(tenantId);
    expect(handoffData.reason).toContain('human agent');

    // Verify system message delivered to customer
    const sysMsg = await systemMsgPromise;
    expect(sysMsg.senderType).toBe('SYSTEM');
    expect(sysMsg.body).toContain('connected to our support queue');

    // Verify ticket created with full transcript
    expect(createdTickets.length).toBe(1);
    expect(createdTickets[0]!.tenantId).toBe(tenantId);
    expect(createdTickets[0]!.description).toContain('Live Chat Transcript');
    expect(createdTickets[0]!.description).toContain('Hello there');
    expect(createdTickets[0]!.description).toContain('speak to a human representative');
    expect(createdTickets[0]!.priority).toBe('MEDIUM');

    agentClient.disconnect();
    visitorClient.disconnect();
  });

  it('triggers high-priority handoff when topic matches blocklist', async () => {
    createdTickets.length = 0;
    const tenantId = 'tenant_handoff_2';
    const conversationId = 'conv_blocklist_1';

    const visitorClient = createClient(`visitor:${tenantId}:visitor_2`);
    await new Promise<void>((res) => {
      visitorClient.on('connect', () => res());
      visitorClient.connect();
    });

    await new Promise<void>((res) => {
      visitorClient.emit('conversation:join', { conversationId }, () => res());
    });

    const stateChangePromise = new Promise<{
      conversationId: string;
      state: string;
      ticketNumber?: number;
      reason?: string;
    }>((res) => {
      visitorClient.on('conversation:state', (data) => res(data));
    });

    // Customer triggers blocklist with "lawsuit" and "fraud"
    await new Promise<void>((res) => {
      visitorClient.emit(
        'message:send',
        {
          conversationId,
          clientId: 'cb1',
          body: 'You charged me twice, this is fraud and I will file a lawsuit with my attorney',
        },
        () => res(),
      );
    });

    const stateData = await stateChangePromise;
    expect(stateData.state).toBe('WAITING_AGENT');
    expect(stateData.reason).toContain('blocklist');

    expect(createdTickets.length).toBe(1);
    expect(createdTickets[0]!.priority).toBe('HIGH');
    expect(createdTickets[0]!.tags).toContain('escalated');

    visitorClient.disconnect();
  });

  it('triggers handoff when AI returns low confidence / should_escalate', async () => {
    createdTickets.length = 0;
    aiShouldEscalate = true;
    aiConfidence = 0.35;
    aiAnswerText = 'I am unable to find an answer in our knowledge base.';

    const tenantId = 'tenant_handoff_3';
    const conversationId = 'conv_ai_low_conf_1';

    const visitorClient = createClient(`visitor:${tenantId}:visitor_3`);
    await new Promise<void>((res) => {
      visitorClient.on('connect', () => res());
      visitorClient.connect();
    });

    await new Promise<void>((res) => {
      visitorClient.emit('conversation:join', { conversationId }, () => res());
    });

    const stateChangePromise = new Promise<{
      conversationId: string;
      state: string;
    }>((res) => {
      visitorClient.on('conversation:state', (data) => res(data));
    });

    // Ask technical question
    await new Promise<void>((res) => {
      visitorClient.emit(
        'message:send',
        {
          conversationId,
          clientId: 'c_ai_1',
          body: 'How do I set up SSO SAML with Azure AD tenant federation?',
        },
        () => res(),
      );
    });

    const stateData = await stateChangePromise;
    expect(stateData.state).toBe('WAITING_AGENT');
    expect(createdTickets.length).toBe(1);
    expect(createdTickets[0]!.description).toContain('Azure AD tenant federation');

    visitorClient.disconnect();
  });

  it('answers directly with AI message when confidence is high', async () => {
    createdTickets.length = 0;
    aiShouldEscalate = false;
    aiConfidence = 0.94;
    aiAnswerText = 'To reset your password, visit account settings and click Security.';

    const tenantId = 'tenant_handoff_4';
    const conversationId = 'conv_ai_success_1';

    const visitorClient = createClient(`visitor:${tenantId}:visitor_4`);
    await new Promise<void>((res) => {
      visitorClient.on('connect', () => res());
      visitorClient.connect();
    });

    await new Promise<void>((res) => {
      visitorClient.emit('conversation:join', { conversationId }, () => res());
    });

    const aiMsgPromise = new Promise<{
      body: string;
      senderType: string;
      citations?: unknown[];
    }>((res) => {
      visitorClient.on('message:new', (msg: any) => {
        if (msg.senderType === 'AI') res(msg);
      });
    });

    await new Promise<void>((res) => {
      visitorClient.emit(
        'message:send',
        {
          conversationId,
          clientId: 'c_pw_1',
          body: 'How do I reset my password?',
        },
        () => res(),
      );
    });

    const aiMsg = await aiMsgPromise;
    expect(aiMsg.senderType).toBe('AI');
    expect(aiMsg.body).toBe(aiAnswerText);
    expect(aiMsg.citations).toBeDefined();

    // No ticket should be created!
    expect(createdTickets.length).toBe(0);

    visitorClient.disconnect();
  });

  it('transitions state to AGENT_ACTIVE when agent sends message', async () => {
    const tenantId = 'tenant_handoff_5';
    const conversationId = 'conv_agent_active_1';

    // Put conversation into WAITING_AGENT state
    await handoffService.setConversationState(conversationId, 'WAITING_AGENT');

    const agentToken = makeAgentToken(tenantId, 'agent_99');
    const agentClient = createClient(agentToken);
    await new Promise<void>((res) => {
      agentClient.on('connect', () => res());
      agentClient.connect();
    });

    await new Promise<void>((res) => {
      agentClient.emit('conversation:join', { conversationId }, () => res());
    });

    const stateChangePromise = new Promise<{
      conversationId: string;
      state: string;
    }>((res) => {
      agentClient.on('conversation:state', (data) => res(data));
    });

    // Agent sends reply
    await new Promise<void>((res) => {
      agentClient.emit(
        'message:send',
        {
          conversationId,
          clientId: 'ag_msg_1',
          body: 'Hello! I am taking over this ticket. How can I assist you?',
        },
        () => res(),
      );
    });

    const stateData = await stateChangePromise;
    expect(stateData.conversationId).toBe(conversationId);
    expect(stateData.state).toBe('AGENT_ACTIVE');

    const finalState = await handoffService.getConversationState(conversationId);
    expect(finalState).toBe('AGENT_ACTIVE');

    agentClient.disconnect();
  });

  it('strictly isolates handoff escalation events across tenants', async () => {
    createdTickets.length = 0;
    const tenantA = 'tenant_isolated_A';
    const tenantB = 'tenant_isolated_B';
    const conversationId = 'conv_isolated_1';

    // Agent B belongs to Tenant B
    const agentBToken = makeAgentToken(tenantB, 'agent_B');
    const agentBClient = createClient(agentBToken);
    await new Promise<void>((res) => {
      agentBClient.on('connect', () => res());
      agentBClient.connect();
    });

    let agentBReceivedEscalation = false;
    agentBClient.on('handoff:escalated', () => {
      agentBReceivedEscalation = true;
    });

    // Visitor belongs to Tenant A and requests human
    const visitorAClient = createClient(`visitor:${tenantA}:visitor_A`);
    await new Promise<void>((res) => {
      visitorAClient.on('connect', () => res());
      visitorAClient.connect();
    });

    await new Promise<void>((res) => {
      visitorAClient.emit('conversation:join', { conversationId }, () => res());
    });

    await new Promise<void>((res) => {
      visitorAClient.emit(
        'message:send',
        {
          conversationId,
          clientId: 'ca_iso_1',
          body: 'I demand to speak to an agent immediately',
        },
        () => res(),
      );
    });

    // Wait a brief moment to confirm Agent B receives nothing
    await new Promise((r) => setTimeout(r, 100));

    expect(agentBReceivedEscalation).toBe(false);
    expect(createdTickets.length).toBe(1);
    expect(createdTickets[0]!.tenantId).toBe(tenantA);

    agentBClient.disconnect();
    visitorAClient.disconnect();
  });
});
