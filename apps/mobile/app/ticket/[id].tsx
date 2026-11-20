import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mobileApi } from '../../src/lib/api.js';
import { mobileSocketManager } from '../../src/lib/socket.js';
import { useAuthStore } from '../../src/lib/auth.store.js';

export interface TicketDetailScreenProps {
  ticketId: string;
  onBack?: () => void;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderType: 'CUSTOMER' | 'AGENT' | 'AI' | 'SYSTEM';
  text: string;
  isInternal?: boolean;
  timestamp: string | number;
}

export default function TicketDetailScreen({ ticketId, onBack }: TicketDetailScreenProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [inputText, setInputText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // 1. Fetch ticket details
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket-detail', ticketId],
    queryFn: async () => {
      const res = await mobileApi.tickets.getById(ticketId);
      return res.data || res;
    },
  });

  // 2. Setup Socket.IO for real-time room communication (MOB-3)
  useEffect(() => {
    const socket = mobileSocketManager.connect();
    const room = `ticket:${ticketId}`;
    mobileSocketManager.joinRoom(room);

    const handleMessage = (data: any) => {
      if (data.roomId === room || data.ticketId === ticketId) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_${Math.random()}`,
            senderName: data.senderName || 'User',
            senderType: data.senderType || 'CUSTOMER',
            text: data.text || data.content,
            isInternal: Boolean(data.isInternal),
            timestamp: data.timestamp || Date.now(),
          },
        ]);
      }
    };

    socket.on('chat:broadcast', handleMessage);
    socket.on('chat:message', handleMessage);

    return () => {
      mobileSocketManager.leaveRoom(room);
      socket.off('chat:broadcast', handleMessage);
      socket.off('chat:message', handleMessage);
    };
  }, [ticketId]);

  // 3. Send Message Mutation
  const replyMutation = useMutation({
    mutationFn: async (payload: { text: string; isInternal: boolean }) => {
      // 1. Emit real-time socket message
      mobileSocketManager.sendMessage(`ticket:${ticketId}`, payload);

      // 2. Send via REST API
      return mobileApi.tickets.reply(ticketId, {
        body: payload.text,
        isInternal: payload.isInternal,
      });
    },
    onSuccess: (_, variables) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_local_${Date.now()}`,
          senderName: user?.name || 'Me',
          senderType: 'AGENT',
          text: variables.text,
          isInternal: variables.isInternal,
          timestamp: Date.now(),
        },
      ]);
      setInputText('');
      void queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
    },
  });

  const handleSend = () => {
    if (!inputText.trim()) return;
    replyMutation.mutate({ text: inputText.trim(), isInternal });
  };

  // 4. Quick Action: Update Status (MOB-5)
  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) => mobileApi.tickets.update(ticketId, { status: newStatus }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
    },
  });

  // 5. AI Suggest Reply Chip (MOB-5)
  const handleDraftWithAi = async () => {
    setIsGeneratingAi(true);
    try {
      const lastCustomerMsg = [...messages].reverse().find((m) => m.senderType === 'CUSTOMER');
      const query = lastCustomerMsg ? lastCustomerMsg.text : ticket?.subject || 'Support request';
      const result = await mobileApi.ai.suggestReply(ticketId, query);
      if (result.suggestion) {
        setInputText(result.suggestion);
      }
    } catch {
      setInputText(
        'Thank you for reaching out to SupportPilot. I am reviewing your request and will follow up shortly.',
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '24px', color: '#94a3b8', textAlign: 'center' }}>
        Loading conversation...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0f172a',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ←
            </button>
          )}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>
              #{ticket?.number || 'TKT'} {ticket?.subject}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Status: {ticket?.status || 'OPEN'}
            </div>
          </div>
        </div>

        {/* Quick Status Action */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => updateStatusMutation.mutate('RESOLVED')}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#064e3b',
              color: '#6ee7b7',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Resolve
          </button>
        </div>
      </div>

      {/* Messages Thread */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Ticket Initial Description */}
        <div
          style={{
            alignSelf: 'flex-start',
            maxWidth: '85%',
            backgroundColor: '#1e293b',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid #334155',
          }}
        >
          <div
            style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '4px' }}
          >
            Customer Initial Message
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>
            {ticket?.description}
          </p>
        </div>

        {messages.map((m) => {
          const isMe = m.senderType === 'AGENT';
          const isYellowNote = m.isInternal;

          let bg = isMe ? '#0369a1' : '#1e293b';
          let textColor = '#f8fafc';
          if (isYellowNote) {
            bg = '#78350f';
            textColor = '#fef3c7';
          }

          return (
            <div
              key={m.id}
              style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: bg,
                color: textColor,
                padding: '10px 14px',
                borderRadius: '12px',
                border: isYellowNote ? '1px solid #b45309' : '1px solid transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '2px',
                  fontSize: '10px',
                  opacity: 0.8,
                }}
              >
                <span>
                  {m.senderName} {isYellowNote && '(Internal Note)'}
                </span>
              </div>
              <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          );
        })}
      </div>

      {/* AI Suggestion Chip (MOB-5) */}
      <div style={{ padding: '6px 16px', backgroundColor: '#0f172a', display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={handleDraftWithAi}
          disabled={isGeneratingAi}
          style={{
            background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
            border: 'none',
            borderRadius: '16px',
            color: '#fff',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ✨ {isGeneratingAi ? 'Synthesizing...' : 'Draft with AI'}
        </button>
      </div>

      {/* Composer */}
      <div
        style={{ padding: '12px 16px', backgroundColor: '#1e293b', borderTop: '1px solid #334155' }}
      >
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: isInternal ? '#fde047' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
            />
            Internal Note
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isInternal ? 'Type private agent note...' : 'Type reply to customer...'}
            rows={2}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: isInternal ? '1px solid #b45309' : '1px solid #334155',
              backgroundColor: isInternal ? '#451a03' : '#0f172a',
              color: '#fff',
              fontSize: '13px',
              resize: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || replyMutation.isPending}
            style={{
              padding: '0 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isInternal ? '#b45309' : '#0284c7',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
