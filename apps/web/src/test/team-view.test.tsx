import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamView } from '../components/team/TeamView';
import { api } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { mockTeamMember } from './mocks';

describe('TeamView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders team member list with role badge and status', async () => {
    vi.spyOn(api.team, 'list').mockResolvedValueOnce([mockTeamMember]);

    renderWithQueryClient(<TeamView />);

    await waitFor(() => {
      expect(screen.getByTestId('team-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Alex Agent')).toBeInTheDocument();
    expect(screen.getByText('agent@supportpilot.io')).toBeInTheDocument();
    expect(screen.getByTestId('role-badge-AGENT')).toHaveTextContent('Support Agent');
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('opens invite modal and submits member invitation', async () => {
    vi.spyOn(api.team, 'list').mockResolvedValueOnce([mockTeamMember]);
    const inviteSpy = vi.spyOn(api.team, 'invite').mockResolvedValueOnce({
      id: 'user_456',
      name: 'Sarah Connor',
      email: 'sarah@supportpilot.io',
      role: 'LEAD',
      status: 'INVITED',
      createdAt: new Date().toISOString(),
    });

    renderWithQueryClient(<TeamView />);

    await waitFor(() => {
      expect(screen.getByTestId('invite-member-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('invite-member-btn'));
    expect(screen.getByTestId('invite-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('invite-name-input'), {
      target: { value: 'Sarah Connor' },
    });
    fireEvent.change(screen.getByTestId('invite-email-input'), {
      target: { value: 'sarah@supportpilot.io' },
    });
    fireEvent.change(screen.getByTestId('invite-role-select'), {
      target: { value: 'LEAD' },
    });

    fireEvent.click(screen.getByTestId('invite-submit-btn'));

    await waitFor(() => {
      expect(inviteSpy).toHaveBeenCalledWith({
        name: 'Sarah Connor',
        email: 'sarah@supportpilot.io',
        role: 'LEAD',
      });
    });
  });
});
