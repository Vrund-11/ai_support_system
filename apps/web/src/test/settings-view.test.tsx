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

  it('navigates to billing tab, renders quotas and PRO features, and upgrades plan via simulated Stripe', async () => {
    vi.spyOn(api.apiKeys, 'list').mockResolvedValueOnce([]);
    vi.spyOn(api.billing, 'getSubscription').mockResolvedValueOnce({
      plan: 'FREE',
      limits: { messages: 500, ai: 50, kb: 10 * 1024 * 1024 },
      usage: { messages: 12, ai: 4, kb: 1.2 * 1024 * 1024 },
    });
    const checkoutSpy = vi.spyOn(api.billing, 'createCheckout').mockResolvedValueOnce({
      checkoutUrl: 'https://checkout.stripe.com/mock',
      sessionId: 'cs_test_123',
    });

    renderWithQueryClient(<SettingsView />);

    const billingTab = screen.getByRole('button', { name: /billing & plans/i });
    await userEvent.click(billingTab);

    await waitFor(() => {
      expect(screen.getByText('SupportPilot FREE')).toBeInTheDocument();
    });

    // Check quota meters and pro features
    expect(screen.getByText('12 / 500')).toBeInTheDocument();
    expect(screen.getByText('4 / 50')).toBeInTheDocument();
    expect(screen.getByText('1.2MB / 10MB')).toBeInTheDocument();
    expect(screen.getByText('Unlimited live chat')).toBeInTheDocument();
    expect(screen.getByText('10,000 messages/mo')).toBeInTheDocument();
    expect(screen.getByText('1,000 AI answers')).toBeInTheDocument();
    expect(screen.getByText('100MB Knowledge Base')).toBeInTheDocument();
    expect(screen.getByText('Priority SLA (15 min response)')).toBeInTheDocument();

    // Open upgrade modal
    const upgradeBtn = screen.getByRole('button', { name: /upgrade to pro/i });
    await userEvent.click(upgradeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Instant Test Upgrade (Simulated Stripe)')).toBeInTheDocument();

    // Instant test upgrade
    const instantUpgradeBtn = screen.getByRole('button', {
      name: /instant test upgrade \(simulated stripe\)/i,
    });
    await userEvent.click(instantUpgradeBtn);

    await waitFor(() => {
      expect(checkoutSpy).toHaveBeenCalledWith('PRO');
      expect(screen.getByText('Active Pro Subscription')).toBeInTheDocument();
    });
  });

  it('supports simulated webhook payment in upgrade modal', async () => {
    vi.spyOn(api.apiKeys, 'list').mockResolvedValueOnce([]);
    vi.spyOn(api.billing, 'getSubscription').mockResolvedValueOnce({
      plan: 'FREE',
      limits: { messages: 500, ai: 50, kb: 10 * 1024 * 1024 },
      usage: { messages: 12, ai: 4, kb: 1.2 * 1024 * 1024 },
    });
    const webhookSpy = vi.spyOn(api.billing, 'simulateWebhook').mockResolvedValueOnce({
      received: true,
      status: 'subscription.updated',
    });

    renderWithQueryClient(<SettingsView />);

    const billingTab = screen.getByRole('button', { name: /billing & plans/i });
    await userEvent.click(billingTab);

    await waitFor(() => {
      expect(screen.getByText('SupportPilot FREE')).toBeInTheDocument();
    });

    const upgradeBtn = screen.getByRole('button', { name: /upgrade to pro/i });
    await userEvent.click(upgradeBtn);

    const webhookBtn = screen.getByRole('button', { name: /simulate webhook payment/i });
    await userEvent.click(webhookBtn);

    await waitFor(() => {
      expect(webhookSpy).toHaveBeenCalled();
      expect(screen.getByText('Active Pro Subscription')).toBeInTheDocument();
    });
  });

  it('allows owner to update tenant plan in admin tab', async () => {
    vi.spyOn(api.apiKeys, 'list').mockResolvedValueOnce([]);
    vi.spyOn(api.admin, 'listTenants').mockResolvedValueOnce([
      {
        id: 't-1',
        name: 'Acme Corp',
        slug: 'acme',
        plan: 'FREE',
        status: 'ACTIVE',
        userCount: 4,
        ticketCount: 18,
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.spyOn(api.admin, 'getHealth').mockResolvedValueOnce({
      status: 'healthy',
      database: 'connected',
      uptimeSeconds: 3600,
    });
    const updatePlanSpy = vi.spyOn(api.admin, 'updateTenantPlan').mockResolvedValueOnce({
      success: true,
      plan: 'PRO',
    });

    renderWithQueryClient(<SettingsView />);

    const adminTab = screen.getByRole('button', { name: /platform admin/i });
    await userEvent.click(adminTab);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    const planSelect = screen.getByLabelText(/change plan for acme corp/i);
    expect(planSelect).toHaveValue('FREE');

    await userEvent.selectOptions(planSelect, 'PRO');

    expect(updatePlanSpy).toHaveBeenCalledWith('t-1', 'PRO');
  });
});
