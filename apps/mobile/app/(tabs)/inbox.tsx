import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mobileApi } from '../../src/lib/api.js';
import { useAuthStore } from '../../src/lib/auth.store.js';

export interface InboxScreenProps {
  onSelectTicket?: (ticketId: string) => void;
}

export default function InboxScreen({ onSelectTicket }: InboxScreenProps) {
  const [segment, setSegment] = useState<'mine' | 'waiting' | 'all'>('all');
  const user = useAuthStore((state) => state.user);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile-tickets', segment],
    queryFn: async () => {
      let status: string | undefined;
      if (segment === 'waiting') status = 'WAITING_AGENT';
      const res = await mobileApi.tickets.list({ status });
      return res.data || [];
    },
  });

  const tickets = (data || []).filter((t: any) => {
    if (segment === 'mine' && user) {
      return t.assignedAgentId === user.id || t.assigneeId === user.id;
    }
    return true;
  });

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'URGENT':
        return '#ef4444';
      case 'HIGH':
        return '#f97316';
      case 'MEDIUM':
        return '#eab308';
      default:
        return '#94a3b8';
    }
  };

  const getStatusBg = (s: string) => {
    switch (s) {
      case 'OPEN':
      case 'NEW':
        return '#1e3a8a';
      case 'WAITING_AGENT':
        return '#831843';
      case 'RESOLVED':
        return '#064e3b';
      default:
        return '#334155';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0f172a',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
          Ticket Inbox
        </h1>
        <button
          onClick={() => void refetch()}
          disabled={isRefetching}
          style={{
            background: 'none',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#38bdf8',
            padding: '4px 8px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {isRefetching ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* Segmented Control */}
      <div style={{ display: 'flex', padding: '8px 16px', gap: '8px', backgroundColor: '#1e293b' }}>
        {(['all', 'mine', 'waiting'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSegment(tab)}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: segment === tab ? '#0284c7' : 'transparent',
              color: segment === tab ? '#fff' : '#94a3b8',
              fontWeight: segment === tab ? '600' : 'normal',
              fontSize: '13px',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'mine' ? 'Assigned' : tab}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#94a3b8' }}>
              You&apos;re all caught up.
            </div>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
              No tickets pending in this view.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tickets.map((t: any) => (
              <div
                key={t.id || t._id}
                onClick={() => onSelectTicket && onSelectTicket(t.id || t._id)}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                  padding: '14px',
                  border: '1px solid #334155',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8' }}>
                    #{t.number || t.ticketNumber || 'TKT'}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: getPriorityColor(t.priority),
                        fontWeight: 'bold',
                      }}
                    >
                      {t.priority}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: getStatusBg(t.status),
                        color: '#fff',
                        fontWeight: '600',
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>
                  {t.subject || t.title}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {t.customerName || t.customerEmail || 'Customer Inquiry'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
