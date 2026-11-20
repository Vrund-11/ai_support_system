import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './types.js';
import type { Role } from '@supportpilot/shared-types';

interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role | 'VISITOR';
  email?: string;
  type?: string;
  visitorId?: string;
}

export function createSocketAuthMiddleware(jwtSecret: string) {
  return (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    next: (err?: Error) => void,
  ) => {
    let token: string | undefined = socket.handshake.auth?.['token'];

    if (!token && socket.handshake.headers['authorization']) {
      const authHeader = socket.handshake.headers['authorization'];
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      }
    }

    if (!token) {
      next(new Error('Authentication error: token missing'));
      return;
    }

    // 1. Check formatted visitor token: visitor:<tenantId>:<visitorId>
    if (token.startsWith('visitor:')) {
      const parts = token.split(':');
      if (parts.length === 3 && parts[1] && parts[2]) {
        const tenantId = parts[1];
        const visitorId = parts[2];
        socket.data.user = {
          id: visitorId,
          tenantId,
          role: 'VISITOR',
          isVisitor: true,
        };
        next();
        return;
      }
    }

    // 2. Verify JWT token
    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      if (!decoded.tenantId) {
        next(new Error('Authentication error: missing tenantId in token'));
        return;
      }

      if (decoded.type === 'VISITOR' || decoded.role === 'VISITOR') {
        const visitorId = decoded.visitorId || decoded.sub;
        socket.data.user = {
          id: visitorId,
          tenantId: decoded.tenantId,
          role: 'VISITOR',
          isVisitor: true,
          email: decoded.email,
        };
        next();
        return;
      }

      if (!decoded.sub || !decoded.role) {
        next(new Error('Authentication error: invalid user token claims'));
        return;
      }

      socket.data.user = {
        id: decoded.sub,
        tenantId: decoded.tenantId,
        role: decoded.role,
        isVisitor: false,
        email: decoded.email,
      };
      next();
    } catch {
      next(new Error('Authentication error: token invalid or expired'));
    }
  };
}
