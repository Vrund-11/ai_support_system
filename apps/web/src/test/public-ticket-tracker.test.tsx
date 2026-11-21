import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublicTicketTracker } from '../components/help/PublicTicketTracker';
import { renderWithQueryClient } from './test-utils';
import { api, ApiError } from '../lib/api';

describe('PublicTicketTracker Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders lookup inputs and handles successful ticket lookup', async () => {
    const mockTrackData = {
      ticket: {
        id: 'tick-123',
        number: 1042,
        subject: 'Cannot access billing dashboard',
        description: 'Receiving 403 error when clicking billing tab.',
        status: 'OPEN' as const,
        priority: 'HIGH' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      timeline: [
        {
          id: 'evt-1',
          tenantId: 'tenant-1',
          ticketId: 'tick-123',
          type: 'STATUS' as const,
          actorId: 'cust-1',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'evt-2',
          tenantId: 'tenant-1',
          ticketId: 'tick-123',
          type: 'STATUS' as const,
          actorId: 'agent-1',
          createdAt: new Date().toISOString(),
        },
      ],
      messages: [
        {
          id: 'msg-1',
          tenantId: 'tenant-1',
          ticketId: 'tick-123',
          seq: 1,
          senderType: 'CUSTOMER' as const,
          senderId: 'cust-1',
          body: 'Receiving 403 error when clicking billing tab.',
          isInternal: false,
          attachments: [],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          tenantId: 'tenant-1',
          ticketId: 'tick-123',
          seq: 2,
          senderType: 'AGENT' as const,
          senderId: 'agent-1',
          body: 'We are investigating your permissions now.',
          isInternal: false,
          attachments: [],
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const trackSpy = vi.spyOn(api.publicTickets, 'track').mockResolvedValueOnce(mockTrackData);

    renderWithQueryClient(<PublicTicketTracker />);

    const numInput = screen.getByTestId('tracker-number-input');
    const emailInput = screen.getByTestId('tracker-email-input');

    fireEvent.change(numInput, { target: { value: '1042' } });
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } });

    const form = numInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(trackSpy).toHaveBeenCalledWith('1042', 'jane@example.com');
      expect(screen.getByText('#1042')).toBeInTheDocument();
      expect(screen.getByText('Cannot access billing dashboard')).toBeInTheDocument();
      expect(screen.getByText('We are investigating your permissions now.')).toBeInTheDocument();
    });
  });

  it('renders error notice when lookup fails with ApiError', async () => {
    vi.spyOn(api.publicTickets, 'track').mockRejectedValueOnce(
      new ApiError(404, 'Not Found', 'No ticket found with number #9999.'),
    );

    renderWithQueryClient(<PublicTicketTracker />);

    const numInput = screen.getByTestId('tracker-number-input');
    const emailInput = screen.getByTestId('tracker-email-input');

    fireEvent.change(numInput, { target: { value: '9999' } });
    fireEvent.change(emailInput, { target: { value: 'notfound@example.com' } });

    const form = numInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('No ticket found with number #9999.')).toBeInTheDocument();
    });
  });

  it('fires onBack callback when back button clicked', async () => {
    const handleBack = vi.fn();
    renderWithQueryClient(<PublicTicketTracker onBack={handleBack} />);

    const backBtn = screen.getByRole('button', { name: /^back$/i });
    await userEvent.click(backBtn);

    expect(handleBack).toHaveBeenCalledTimes(1);
  });
});
