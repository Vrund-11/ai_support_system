import type { Role } from '@supportpilot/shared-types';

export interface SocketUser {
  id: string;
  tenantId: string;
  role: Role | 'VISITOR';
  isVisitor: boolean;
  email?: string;
}

export interface ClientToServerEvents {
  'conversation:join': (
    payload: { conversationId: string; lastSeq?: number },
    ack?: (response: { status: 'ok' | 'error'; error?: string }) => void,
  ) => void;
  'conversation:leave': (
    payload: { conversationId: string },
    ack?: (response: { status: 'ok' }) => void,
  ) => void;
  'message:send': (
    payload: {
      conversationId: string;
      clientId: string;
      body: string;
      attachments?: unknown[];
    },
    ack?: (response: { status: 'ok' | 'error'; seq?: number; error?: string }) => void,
  ) => void;
  'typing:start': (payload: { conversationId: string }) => void;
  'typing:stop': (payload: { conversationId: string }) => void;
  'message:read': (payload: { conversationId: string; upToSeq: number }) => void;
}

export interface ServerToClientEvents {
  'message:new': (message: unknown) => void;
  'message:ack': (ack: { clientId: string; seq: number }) => void;
  'conversation:state': (state: {
    conversationId: string;
    state: string;
    ticketId?: string;
    ticketNumber?: number;
    reason?: string;
  }) => void;
  'handoff:escalated': (handoff: {
    conversationId: string;
    tenantId: string;
    ticketId: string;
    ticketNumber?: number;
    reason: string;
  }) => void;
  typing: (typing: { conversationId: string; who: string; isTyping: boolean }) => void;
  'presence:update': (presence: { userId: string; status: 'online' | 'offline' }) => void;
  'message:read': (receipt: { conversationId: string; userId: string; upToSeq: number }) => void;
  'ticket:updated': (ticket: unknown) => void;
  'notification:new': (notification: { type: string; ticketId?: string; text: string }) => void;
  'kb:ingestion': (status: { documentId: string; status: string }) => void;
}

export interface SocketData {
  user: SocketUser;
}
