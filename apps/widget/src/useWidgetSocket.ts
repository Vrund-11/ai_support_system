import { useState, useEffect, useRef, useCallback } from 'react';
import { io as Client, type Socket } from 'socket.io-client';
import type { WidgetMessage } from './types';

interface UseWidgetSocketProps {
  tenantId: string;
  gatewayUrl: string;
  conversationId: string;
}

export function useWidgetSocket({ tenantId, gatewayUrl, conversationId }: UseWidgetSocketProps) {
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastSeqRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Visitor ID persistence
  const getVisitorId = useCallback((): string => {
    let id = localStorage.getItem('supportpilot_visitor_id');
    if (!id) {
      id = 'vis_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('supportpilot_visitor_id', id);
    }
    return id;
  }, []);

  useEffect(() => {
    const visitorId = getVisitorId();
    const visitorToken = `visitor:${tenantId}:${visitorId}`;

    const socket = Client(gatewayUrl, {
      auth: { token: visitorToken },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Join conversation room with message replay
      socket.emit(
        'conversation:join',
        { conversationId, lastSeq: lastSeqRef.current },
        (res: { status: string }) => {
          if (res?.status === 'ok') {
            // Joined successfully
          }
        },
      );
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('message:new', (newMsg: WidgetMessage) => {
      if (newMsg.seq > lastSeqRef.current) {
        lastSeqRef.current = newMsg.seq;
      }
      setMessages((prev) => {
        // If local optimistic message exists, replace it
        if (newMsg.clientId) {
          const idx = prev.findIndex((m) => m.clientId === newMsg.clientId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = newMsg;
            return next;
          }
        }
        // Avoid duplicate by seq or id
        if (prev.some((m) => m.id === newMsg.id || m.seq === newMsg.seq)) {
          return prev;
        }
        return [...prev, newMsg];
      });
    });

    socket.on('message:ack', (ack: { clientId: string; seq: number }) => {
      setMessages((prev) =>
        prev.map((m) => (m.clientId === ack.clientId ? { ...m, seq: ack.seq, pending: false } : m)),
      );
    });

    socket.on('typing', (data: { who: string; isTyping: boolean }) => {
      setIsTyping(data.isTyping);
    });

    return () => {
      socket.disconnect();
    };
  }, [tenantId, gatewayUrl, conversationId, getVisitorId]);

  const sendMessage = useCallback(
    (body: string) => {
      if (!body.trim() || !socketRef.current) return;

      const clientId = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const optimisticMsg: WidgetMessage = {
        id: clientId,
        seq: lastSeqRef.current + 1,
        clientId,
        body: body.trim(),
        senderType: 'CUSTOMER',
        createdAt: new Date().toISOString(),
        pending: true,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      socketRef.current.emit(
        'message:send',
        {
          conversationId,
          clientId,
          body: body.trim(),
        },
        (ack: { status: string; seq?: number }) => {
          if (ack?.status === 'ok' && ack.seq) {
            lastSeqRef.current = Math.max(lastSeqRef.current, ack.seq);
          }
        },
      );
    },
    [conversationId],
  );

  const notifyTyping = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('typing:start', { conversationId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', { conversationId });
    }, 2000);
  }, [conversationId]);

  return {
    messages,
    isConnected,
    isTyping,
    sendMessage,
    notifyTyping,
  };
}
