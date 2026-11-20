import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'node:http';
import type { Redis } from 'ioredis';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './types.js';
import { createSocketAuthMiddleware } from './auth.js';
import { tenantRoom, userRoom, conversationRoom } from './rooms.js';

export interface SocketServerOptions {
  jwtSecret: string;
  redisPubClient?: Redis;
  redisSubClient?: Redis;
  corsOrigin?: string | string[];
}

export type GatewaySocketServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function createSocketServer(
  httpServer: HttpServer,
  options: SocketServerOptions,
): GatewaySocketServer {
  const io: GatewaySocketServer = new SocketServer(httpServer, {
    cors: {
      origin: options.corsOrigin || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

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

    // Join conversation room
    socket.on('conversation:join', (payload, ack) => {
      const { conversationId } = payload;
      if (!conversationId) {
        ack?.({ status: 'error', error: 'conversationId is required' });
        return;
      }
      void socket.join(conversationRoom(conversationId));
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
  });

  return io;
}
