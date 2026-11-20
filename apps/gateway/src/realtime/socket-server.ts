import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'node:http';
import type { Redis } from 'ioredis';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './types.js';
import { createSocketAuthMiddleware } from './auth.js';
import { tenantRoom, userRoom, conversationRoom } from './rooms.js';
import { SequenceService, type StoredMessage } from './sequence.js';

export interface SocketServerOptions {
  jwtSecret: string;
  redisPubClient?: Redis;
  redisSubClient?: Redis;
  corsOrigin?: string | string[];
  sequenceService?: SequenceService;
}

export type GatewaySocketServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
> & {
  sequenceService: SequenceService;
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
  io.sequenceService = sequenceService;

  // Configure Redis adapter for horizontal scaling if Redis clients provided
  if (options.redisPubClient && options.redisSubClient) {
    io.adapter(createAdapter(options.redisPubClient, options.redisSubClient));
  }

  // Register handshake authentication middleware
  io.use(createSocketAuthMiddleware(options.jwtSecret));

  // Connection handler & room assignments
  io.on('connection', (socket) => {
    const user = socket.data.user;

    // Join user-specific room
    void socket.join(userRoom(user.id));

    // Authenticated agents/leads/owners join the tenant room
    if (!user.isVisitor) {
      void socket.join(tenantRoom(user.tenantId));
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
      const { conversationId, clientId, body } = payload;
      if (!conversationId || !body) {
        ack?.({ status: 'error', error: 'conversationId and body are required' });
        return;
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
  });

  return io;
}
