import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { TicketDetail } from '../components/tickets/TicketDetail';
import { api, ApiError } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { mockTicket, mockMessages, mockTimeline } from './mocks';

describe('TicketDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ticket details, messages, and activity timeline', async () => {
    vi.spyOn(api.tickets, 'get').mockResolvedValueOnce({
      ticket: mockTicket,
      timeline: mockTimeline,
      messages: mockMessages,
    });

    renderWithQueryClient(<TicketDetail ticketId="ticket_abc" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('ticket-detail-view')).toBeInTheDocument();
    });

    expect(screen.getByText('Cannot login to account')).toBeInTheDocument();
    expect(screen.getByText('Customer says their 2FA is locked out')).toBeInTheDocument();

    // Verify messages and timeline
    expect(screen.getByText('I cannot receive the 2FA SMS code.')).toBeInTheDocument();
    expect(
      screen.getByText('Checking carrier logs now. Please verify phone number.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Internal Note').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('activity-timeline')).toBeInTheDocument();
  });

  it('updates ticket status and passes current version', async () => {
    vi.spyOn(api.tickets, 'get').mockResolvedValueOnce({
      ticket: mockTicket,
      timeline: mockTimeline,
      messages: mockMessages,
    });

    const updateSpy = vi.spyOn(api.tickets, 'update').mockResolvedValueOnce({
      ...mockTicket,
      status: 'RESOLVED',
      version: 3,
    });

    renderWithQueryClient(<TicketDetail ticketId="ticket_abc" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('detail-status-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('detail-status-select'), {
      target: { value: 'RESOLVED' },
    });

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('ticket_abc', {
        version: mockTicket.version,
        status: 'RESOLVED',
      });
    });
  });

  it('posts an internal note when internal tab is selected', async () => {
    vi.spyOn(api.tickets, 'get').mockResolvedValue({
      ticket: mockTicket,
      timeline: mockTimeline,
      messages: mockMessages,
    });

    const addMessageSpy = vi.spyOn(api.tickets, 'addMessage').mockResolvedValueOnce({
      id: 'msg_3',
      tenantId: 'tenant_123',
      ticketId: 'ticket_abc',
      seq: 3,
      senderType: 'AGENT',
      body: 'Verified user ID with passport scan.',
      isInternal: true,
      createdAt: new Date().toISOString(),
    });

    renderWithQueryClient(<TicketDetail ticketId="ticket_abc" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('composer-internal-tab')).toBeInTheDocument();
    });

    // Select internal note tab
    fireEvent.click(screen.getByTestId('composer-internal-tab'));

    fireEvent.change(screen.getByTestId('message-textarea'), {
      target: { value: 'Verified user ID with passport scan.' },
    });

    fireEvent.click(screen.getByTestId('send-message-button'));

    await waitFor(() => {
      expect(addMessageSpy).toHaveBeenCalledWith(
        'ticket_abc',
        'Verified user ID with passport scan.',
        true,
      );
    });
  });

  it('displays conflict warning when update returns 409', async () => {
    vi.spyOn(api.tickets, 'get').mockResolvedValue({
      ticket: mockTicket,
      timeline: mockTimeline,
      messages: mockMessages,
    });

    vi.spyOn(api.tickets, 'update').mockRejectedValueOnce(
      new ApiError(409, 'Conflict', 'Version conflict'),
    );

    renderWithQueryClient(<TicketDetail ticketId="ticket_abc" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('detail-status-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('detail-status-select'), {
      target: { value: 'RESOLVED' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('conflict-warning')).toBeInTheDocument();
    });
  });
});
