import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'node:http';
import type { Redis } from 'ioredis';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './types.js';
import { createSocketAuthMiddleware } from './auth.js';
import { tenantRoom, userRoom, conversationRoom } from './rooms.js';
import { SequenceService, type StoredMessage } from './sequence.js';
import { PresenceService } from './presence.js';

export interface SocketServerOptions {
  jwtSecret: string;
  redisPubClient?: Redis;
  redisSubClient?: Redis;
  corsOrigin?: string | string[];
  sequenceService?: SequenceService;
  presenceService?: PresenceService;
}

export type GatewaySocketServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
> & {
  sequenceService: SequenceService;
  presenceService: PresenceService;
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

  io.sequenceService = sequenceService;
  io.presenceService = presenceService;

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
