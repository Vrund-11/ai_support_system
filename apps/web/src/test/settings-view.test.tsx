import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsView } from '../components/settings/SettingsView';
import { api } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { useAuthStore } from '../store/auth.store';

describe('SettingsView Component (INT-1, INT-2, ADM-1, ADM-2, ADM-3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-owner-001',
        tenantId: 'tenant-acme-111',
        email: 'owner@acme.com',
        name: 'Acme Owner',
        role: 'OWNER',
      },
      isAuthenticated: true,
      accessToken: 'test-token',
    });
  });

  it('renders API keys sub-tab, shows keys, and opens generate modal', async () => {
    vi.spyOn(api.apiKeys, 'list').mockResolvedValueOnce([
      {
        id: 'key-1',
        name: 'Zapier Production',
        prefix: 'sp_live_a1b2c3...',
        scopes: ['tickets:read', 'tickets:write'],
        createdAt: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Zapier Production')).toBeInTheDocument();
    });

    expect(screen.getByText('sp_live_a1b2c3...')).toBeInTheDocument();

    const generateBtn = screen.getByRole('button', { name: /generate key/i });
    await userEvent.click(generateBtn);

    expect(screen.getByText('Generate New API Key')).toBeInTheDocument();
  });

  it('navigates to webhooks tab, lists subscriptions, and handles ping', async () => {
    vi.spyOn(api.apiKeys, 'list').mockResolvedValueOnce([]);
    vi.spyOn(api.webhooks, 'list').mockResolvedValueOnce([
      {
        id: 'wh-1',
        url: 'https://example.com/webhook',
        events: ['ticket.created', 'ticket.updated'],
        active: true,
        description: 'CRM Webhook',
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(api.webhooks, 'test').mockResolvedValueOnce({
      delivered: true,
      signature: 'sha256=abcdef1234567890',
    });

    renderWithQueryClient(<SettingsView />);

    const webhooksTab = screen.getByRole('button', { name: /webhooks/i });
    await userEvent.click(webhooksTab);

    await waitFor(() => {
      expect(screen.getByText('https://example.com/webhook')).toBeInTheDocument();
    });

    const pingBtn = screen.getByRole('button', { name: /test ping/i });
    await userEvent.click(pingBtn);

    await waitFor(() => {
      expect(screen.getByText(/Delivered \(200 OK\)/i)).toBeInTheDocument();
    });
  });

  it('navigates to feature flags tab and toggles flag', async () => {
    vi.spyOn(api.apiKeys, 'list').mockResolvedValueOnce([]);
    vi.spyOn(api.featureFlags, 'list').mockResolvedValueOnce([
      {
        key: 'ai_copilot',
        name: 'AI Copilot & Suggestions',
        enabled: true,
        description: 'RAG-grounded reply suggestions',
        updatedAt: new Date().toISOString(),
      },
    ]);
    const toggleSpy = vi.spyOn(api.featureFlags, 'toggle').mockResolvedValueOnce({
      key: 'ai_copilot',
      name: 'AI Copilot & Suggestions',
      enabled: false,
      updatedAt: new Date().toISOString(),
    });

    renderWithQueryClient(<SettingsView />);

    const flagsTab = screen.getByRole('button', { name: /feature flags/i });
    await userEvent.click(flagsTab);

    await waitFor(() => {
      expect(screen.getByText('AI Copilot & Suggestions')).toBeInTheDocument();
    });

    // Toggle button
    const toggleButton = screen.getByRole('button', { name: '' });
    await userEvent.click(toggleButton);

    expect(toggleSpy).toHaveBeenCalledWith('ai_copilot', false);
  });
});
