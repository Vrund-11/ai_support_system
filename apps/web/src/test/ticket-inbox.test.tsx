import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { TicketInbox } from '../components/tickets/TicketInbox';
import { api } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { mockTicket, mockTicket2 } from './mocks';

describe('TicketInbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ticket list with numbers, subjects, statuses and priorities', async () => {
    vi.spyOn(api.tickets, 'list').mockResolvedValueOnce({
      data: [mockTicket, mockTicket2],
    });

    const onSelectTicket = vi.fn();
    renderWithQueryClient(<TicketInbox onSelectTicket={onSelectTicket} onOpenCreate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('tickets-table')).toBeInTheDocument();
    });

    expect(screen.getByText('#1001')).toBeInTheDocument();
    expect(screen.getByText('Cannot login to account')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip-OPEN')).toBeInTheDocument();
    expect(screen.getByTestId('priority-chip-HIGH')).toBeInTheDocument();

    expect(screen.getByText('#1002')).toBeInTheDocument();
    expect(screen.getByText('Billing inquiry')).toBeInTheDocument();
  });

  it('calls onSelectTicket when a ticket row is clicked', async () => {
    vi.spyOn(api.tickets, 'list').mockResolvedValueOnce({
      data: [mockTicket],
    });

    const onSelectTicket = vi.fn();
    renderWithQueryClient(<TicketInbox onSelectTicket={onSelectTicket} onOpenCreate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('ticket-row-ticket_abc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ticket-row-ticket_abc'));
    expect(onSelectTicket).toHaveBeenCalledWith('ticket_abc');
  });

  it('filters tickets when status filter dropdown is changed', async () => {
    const listSpy = vi.spyOn(api.tickets, 'list').mockResolvedValue({
      data: [mockTicket],
    });

    renderWithQueryClient(<TicketInbox onSelectTicket={vi.fn()} onOpenCreate={vi.fn()} />);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ status: '', priority: '' }));
    });

    fireEvent.change(screen.getByTestId('status-filter-select'), {
      target: { value: 'OPEN' },
    });

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }));
    });
  });

  it('shows empty state when no tickets match', async () => {
    vi.spyOn(api.tickets, 'list').mockResolvedValueOnce({
      data: [],
    });

    renderWithQueryClient(<TicketInbox onSelectTicket={vi.fn()} onOpenCreate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('inbox-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No tickets found')).toBeInTheDocument();
  });
});
