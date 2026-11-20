import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveChatView } from '../components/chat/LiveChatView';
import { renderWithQueryClient } from './test-utils';
import { useAuthStore } from '../store/auth.store';

describe('LiveChatView Component (S2-T14)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'user_agent_001',
        tenantId: 'tenant_alpha_111',
        email: 'agent@example.com',
        name: 'Agent Smith',
        role: 'AGENT',
      },
      isAuthenticated: true,
      accessToken: 'test-token',
    });
  });

  it('renders live chat console with queue tabs and active conversation', () => {
    renderWithQueryClient(<LiveChatView />);

    expect(screen.getByText('Live Agent Console')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Waiting \(/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Mine \(/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All \(/i })).toBeInTheDocument();

    // Verify conversation list items
    expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('sarah@skynet-survivors.org').length).toBeGreaterThanOrEqual(1);
  });

  it('displays message thread with customer and AI citation chips', () => {
    renderWithQueryClient(<LiveChatView />);

    expect(
      screen.getByText('Hello, how do I configure SAML SSO in SupportPilot?'),
    ).toBeInTheDocument();
    expect(screen.getByText(/To configure SSO, an account Owner must upload/i)).toBeInTheDocument();
    expect(screen.getByText('SAML Authentication')).toBeInTheDocument();
    expect(
      screen.getByText(/Conversation transferred to human support queue/i),
    ).toBeInTheDocument();
  });

  it('displays AI suggestion panel and copies suggestion into composer on click', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LiveChatView />);

    expect(screen.getByText('AI Suggestion Panel')).toBeInTheDocument();
    expect(screen.getByText(/Recommended Reply/i)).toBeInTheDocument();
    expect(screen.getByText('94% match')).toBeInTheDocument();
    expect(screen.getByText('Authentication and Account Security')).toBeInTheDocument();

    const insertBtn = screen.getByRole('button', { name: /Insert into Reply/i });
    await user.click(insertBtn);

    const input = screen.getByPlaceholderText(/Type reply to customer/i) as HTMLInputElement;
    expect(input.value).toContain(
      'Hello Sarah, I can certainly assist you with verifying your SAML certificate',
    );
  });

  it('allows agent to send a reply in the active conversation', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LiveChatView />);

    const input = screen.getByPlaceholderText(/Type reply to customer/i);
    await user.type(input, 'I am checking your metadata file right now.');

    const sendBtn = screen.getByRole('button', { name: '' }); // Send icon button
    await user.click(sendBtn);

    const matches = screen.getAllByText('I am checking your metadata file right now.');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('allows agent to take over waiting conversation', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LiveChatView />);

    const takeOverBtn = screen.getByRole('button', { name: /Take Over Chat/i });
    await user.click(takeOverBtn);

    expect(screen.getByText(/Agent Smith took over the conversation/i)).toBeInTheDocument();
  });
});
