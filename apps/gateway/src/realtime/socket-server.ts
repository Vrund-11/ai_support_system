import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'node:http';
import type { Redis } from 'ioredis';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './types.js';
import { createSocketAuthMiddleware } from './auth.js';
import { tenantRoom, userRoom, conversationRoom } from './rooms.js';
import { SequenceService, type StoredMessage } from './sequence.js';
import { PresenceService } from './presence.js';
import { HandoffService } from './handoff.js';

export interface SocketServerOptions {
  jwtSecret: string;
  redisPubClient?: Redis;
  redisSubClient?: Redis;
  corsOrigin?: string | string[];
  sequenceService?: SequenceService;
  presenceService?: PresenceService;
  handoffService?: HandoffService;
  enableHandoff?: boolean;
  aiServiceUrl?: string;
  ticketServiceUrl?: string;
  serviceToken?: string;
}

export type GatewaySocketServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
> & {
  sequenceService: SequenceService;
  presenceService: PresenceService;
  handoffService: HandoffService;
};

export function createSocketServer(
  httpServer: HttpServer,
  options: SocketServerOptions,
): GatewaySocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: options.corsOrigin || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  }) as GatewaySocketServer;

  const sequenceService = options.sequenceService ?? new SequenceService(options.redisPubClient);
  const presenceService = options.presenceService ?? new PresenceService(options.redisPubClient);
  const handoffService =
    options.handoffService ??
    new HandoffService({
      redisClient: options.redisPubClient,
      aiServiceUrl: options.aiServiceUrl,
      ticketServiceUrl: options.ticketServiceUrl,
      serviceToken: options.serviceToken,
    });
  const enableHandoff = options.enableHandoff ?? options.handoffService !== undefined;

  io.sequenceService = sequenceService;
  io.presenceService = presenceService;
  io.handoffService = handoffService;

  // Configure Redis adapter for horizontal scaling if Redis clients provided
  if (options.redisPubClient && options.redisSubClient) {
    io.adapter(createAdapter(options.redisPubClient, options.redisSubClient));
  }

  // Register handshake authentication middleware
  io.use(createSocketAuthMiddleware(options.jwtSecret));

  // Connection handler & room assignments
  io.on('connection', async (socket) => {
    const user = socket.data.user;

    // Join user-specific room
    void socket.join(userRoom(user.id));

    // Authenticated agents/leads/owners join the tenant room and update presence
    if (!user.isVisitor) {
      void socket.join(tenantRoom(user.tenantId));
      const becameOnline = await presenceService.userConnected(user.tenantId, user.id);
      if (becameOnline) {
        io.to(tenantRoom(user.tenantId)).emit('presence:update', {
          userId: user.id,
          status: 'online',
        });
      }
    }

    // Join conversation room with message replay (CHAT-6)
    socket.on('conversation:join', async (payload, ack) => {
      const { conversationId, lastSeq } = payload;
      if (!conversationId) {
        ack?.({ status: 'error', error: 'conversationId is required' });
        return;
      }
      void socket.join(conversationRoom(conversationId));

      // Replay all missing messages since lastSeq in ascending order
      if (lastSeq !== undefined && lastSeq >= 0) {
        const missing = await sequenceService.getMessagesSince(conversationId, lastSeq);
        for (const msg of missing) {
          socket.emit('message:new', msg);
        }
      }

      ack?.({ status: 'ok' });
    });

    // Leave conversation room
    socket.on('conversation:leave', (payload, ack) => {
      const { conversationId } = payload;
      if (conversationId) {
        void socket.leave(conversationRoom(conversationId));
      }
      ack?.({ status: 'ok' });
    });

    // Send real-time message with monotonic sequence number and deduplication
    socket.on('message:send', async (payload, ack) => {
      const { conversationId, clientId, body, attachments } = payload;
      if (!conversationId || !body) {
        ack?.({ status: 'error', error: 'conversationId and body are required' });
        return;
      }

      // Strict tenant isolation for attachments
      if (Array.isArray(attachments)) {
        for (const att of attachments) {
          if (
            typeof att === 'object' &&
            att !== null &&
            'key' in att &&
            typeof (att as { key: string }).key === 'string'
          ) {
            if (!(att as { key: string }).key.startsWith(`${user.tenantId}/`)) {
              ack?.({ status: 'error', error: 'Cross-tenant attachment access forbidden' });
              return;
            }
          }
        }
      }

      // Deduplication check by clientId
      if (clientId) {
        const existingSeq = await sequenceService.isDuplicateClientMessage(
          conversationId,
          clientId,
        );
        if (existingSeq !== null) {
          ack?.({ status: 'ok', seq: existingSeq });
          return;
        }
      }

      // Increment sequence number monotonically
      const seq = await sequenceService.getNextSeq(conversationId);

      const message: StoredMessage = {
        id: `msg_${conversationId}_${seq}`,
        conversationId,
        tenantId: user.tenantId,
        seq,
        clientId,
        body,
        senderType: user.isVisitor ? 'CUSTOMER' : 'AGENT',
        senderId: user.id,
        attachments: attachments ?? [],
        createdAt: new Date().toISOString(),
      };

      // Save to sequence buffer
      await sequenceService.saveMessage(conversationId, message);
      if (clientId) {
        await sequenceService.markClientMessageProcessed(conversationId, clientId, seq);
      }

      // Send ack to client
      if (clientId) {
        socket.emit('message:ack', { clientId, seq });
      }

      // Broadcast to room
      io.to(conversationRoom(conversationId)).emit('message:new', message);

      ack?.({ status: 'ok', seq });

      if (!enableHandoff) {
        return;
      }

      // Handle agent responses or customer handoff lifecycle (CHAT-4)
      try {
        if (!user.isVisitor) {
          const currentState = await handoffService.getConversationState(conversationId);
          if (currentState === 'WAITING_AGENT') {
            await handoffService.setConversationState(conversationId, 'AGENT_ACTIVE');
            io.to(conversationRoom(conversationId)).emit('conversation:state', {
              conversationId,
              state: 'AGENT_ACTIVE',
            });
          }
          return;
        }

        // Visitor / Customer message handling
        const convState = await handoffService.getConversationState(conversationId);
        if (convState === 'WAITING_AGENT' || convState === 'AGENT_ACTIVE') {
          // Conversation already transferred to human agent queue
          return;
        }

        // Check immediate handoff triggers (human request or blocklist)
        const immediateTrigger = handoffService.evaluateImmediateTriggers(body);
        if (immediateTrigger.triggered) {
          await handoffService.setConversationState(conversationId, 'WAITING_AGENT');
          const history = await sequenceService.getMessagesSince(conversationId, 0);
          const ticket = await handoffService.createEscalationTicket(
            user.tenantId,
            conversationId,
            history,
            immediateTrigger.reason!,
            immediateTrigger.priority,
          );

          io.to(conversationRoom(conversationId)).emit('conversation:state', {
            conversationId,
            state: 'WAITING_AGENT',
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            reason: immediateTrigger.reason,
          });

          io.to(tenantRoom(user.tenantId)).emit('handoff:escalated', {
            conversationId,
            tenantId: user.tenantId,
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            reason: immediateTrigger.reason!,
          });

          // Emit system transfer message
          const sysSeq = await sequenceService.getNextSeq(conversationId);
          const sysMsg: StoredMessage = {
            id: `msg_${conversationId}_${sysSeq}`,
            conversationId,
            tenantId: user.tenantId,
            seq: sysSeq,
            body: `You have been connected to our support queue (Ticket #${ticket.number}). A support agent will assist you shortly.`,
            senderType: 'SYSTEM',
            senderId: 'system',
            attachments: [],
            createdAt: new Date().toISOString(),
          };
          await sequenceService.saveMessage(conversationId, sysMsg);
          io.to(conversationRoom(conversationId)).emit('message:new', sysMsg);
          return;
        }

        // No immediate trigger -> Call AI Assistant
        io.to(conversationRoom(conversationId)).emit('typing', {
          conversationId,
          who: 'ai',
          isTyping: true,
        });

        const history = await sequenceService.getMessagesSince(conversationId, 0);
        const aiResponse = await handoffService.requestAiAnswer(
          user.tenantId,
          conversationId,
          body,
          history,
        );

        io.to(conversationRoom(conversationId)).emit('typing', {
          conversationId,
          who: 'ai',
          isTyping: false,
        });

        const normalizedCitations = (aiResponse.citations || []).map((c: any) => ({
          chunkId: c.chunk_id || c.chunkId || '',
          docId: c.doc_id || c.docId || '',
          title: c.title || 'Knowledge Base',
        }));

        if (aiResponse.should_escalate) {
          // AI low confidence or inability to answer -> escalate
          await handoffService.setConversationState(conversationId, 'WAITING_AGENT');
          const ticket = await handoffService.createEscalationTicket(
            user.tenantId,
            conversationId,
            history,
            aiResponse.reason || 'AI confidence below threshold',
            'MEDIUM',
          );

          io.to(conversationRoom(conversationId)).emit('conversation:state', {
            conversationId,
            state: 'WAITING_AGENT',
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            reason: aiResponse.reason,
          });

          io.to(tenantRoom(user.tenantId)).emit('handoff:escalated', {
            conversationId,
            tenantId: user.tenantId,
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            reason: aiResponse.reason || 'AI confidence below threshold',
          });

          const aiSeq = await sequenceService.getNextSeq(conversationId);
          const aiMsg: StoredMessage = {
            id: `msg_${conversationId}_${aiSeq}`,
            conversationId,
            tenantId: user.tenantId,
            seq: aiSeq,
            body: `${aiResponse.answer} (Transferring to support agent, Ticket #${ticket.number})`,
            senderType: 'AI',
            senderId: 'ai',
            citations: normalizedCitations,
            attachments: [],
            createdAt: new Date().toISOString(),
          };
          await sequenceService.saveMessage(conversationId, aiMsg);
          io.to(conversationRoom(conversationId)).emit('message:new', aiMsg);
        } else {
          // Confident AI answer -> reply directly
          const aiSeq = await sequenceService.getNextSeq(conversationId);
          const aiMsg: StoredMessage = {
            id: `msg_${conversationId}_${aiSeq}`,
            conversationId,
            tenantId: user.tenantId,
            seq: aiSeq,
            body: aiResponse.answer,
            senderType: 'AI',
            senderId: 'ai',
            citations: normalizedCitations,
            attachments: [],
            createdAt: new Date().toISOString(),
          };
          await sequenceService.saveMessage(conversationId, aiMsg);
          io.to(conversationRoom(conversationId)).emit('message:new', aiMsg);
        }
      } catch (err) {
        console.error('[gateway:socket] Error processing message handoff / AI response:', err);
      }
    });

    // Typing start indicator (broadcast to room except sender)
    socket.on('typing:start', (payload) => {
      const { conversationId } = payload;
      if (conversationId) {
        socket.to(conversationRoom(conversationId)).emit('typing', {
          conversationId,
          who: user.id,
          isTyping: true,
        });
      }
    });

    // Typing stop indicator (broadcast to room except sender)
    socket.on('typing:stop', (payload) => {
      const { conversationId } = payload;
      if (conversationId) {
        socket.to(conversationRoom(conversationId)).emit('typing', {
          conversationId,
          who: user.id,
          isTyping: false,
        });
      }
    });

    // Message read receipt
    socket.on('message:read', async (payload) => {
      const { conversationId, upToSeq } = payload;
      if (conversationId && upToSeq !== undefined) {
        await presenceService.recordReadReceipt(conversationId, user.id, upToSeq);
        io.to(conversationRoom(conversationId)).emit('message:read', {
          conversationId,
          userId: user.id,
          upToSeq,
        });
      }
    });

    // Disconnect cleanup: update presence
    socket.on('disconnect', async () => {
      if (!user.isVisitor) {
        const becameOffline = await presenceService.userDisconnected(user.tenantId, user.id);
        if (becameOffline) {
          io.to(tenantRoom(user.tenantId)).emit('presence:update', {
            userId: user.id,
            status: 'offline',
          });
        }
      }
    });
  });

  return io;
}
