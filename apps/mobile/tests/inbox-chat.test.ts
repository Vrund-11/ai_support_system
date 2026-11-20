import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mobileApi } from '../src/lib/api.js';
import { mobileSocketManager } from '../src/lib/socket.js';
import { useAuthStore } from '../src/lib/auth.store.js';

describe('Mobile Inbox & Ticket Screen Logic (MOB-2, MOB-3, MOB-5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'usr_agent_99',
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        role: 'AGENT',
        tenantId: 'tenant_mobile_test',
      },
      tenantId: 'tenant_mobile_test',
      accessToken: 'test_token',
      isAuthenticated: true,
    });
  });

  it('lists tickets with status filtering from mobileApi', async () => {
    const mockTickets = [
      { id: 't1', number: 101, subject: 'Login issue', status: 'OPEN', priority: 'HIGH' },
      {
        id: 't2',
        number: 102,
        subject: 'Payment failed',
        status: 'WAITING_AGENT',
        priority: 'URGENT',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockTickets, meta: { total: 2 } }),
    } as any);

    const res = await mobileApi.tickets.list({ status: 'OPEN' });
    expect(res.data).toHaveLength(2);
    expect(res.data[0].subject).toBe('Login issue');
  });

  it('fetches single ticket details and executes status update patch', async () => {
    const mockDetail = {
      id: 't1',
      number: 101,
      subject: 'Login issue',
      status: 'OPEN',
      priority: 'HIGH',
      description: 'Customer cannot authenticate',
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDetail }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { ...mockDetail, status: 'RESOLVED' } }),
      } as any);

    const ticket = await mobileApi.tickets.getById('t1');
    expect(ticket.data.status).toBe('OPEN');

    const updated = await mobileApi.tickets.update('t1', { status: 'RESOLVED' });
    expect(updated.data.status).toBe('RESOLVED');
  });

  it('connects to Socket.IO and emits chat:message with agent credentials', () => {
    const mockSocket = {
      connected: true,
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
    };

    mobileSocketManager.setSocketForTesting(mockSocket);
    mobileSocketManager.joinRoom('ticket:t1');
    mobileSocketManager.sendMessage('ticket:t1', { text: 'Hello customer', isInternal: false });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'chat:message',
      expect.objectContaining({
        roomId: 'ticket:t1',
        text: 'Hello customer',
        senderName: 'Sarah Connor',
        senderType: 'AGENT',
      }),
    );
  });

  it('fetches AI suggestion draft for ticket (MOB-5)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestion: 'To reset your password, visit the settings tab.',
        citations: [],
      }),
    } as any);

    const result = await mobileApi.ai.suggestReply('t1', 'How do I reset password?');
    expect(result.suggestion).toContain('visit the settings tab');
  });
});
