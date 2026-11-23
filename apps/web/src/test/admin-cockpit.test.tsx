import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminCockpitView } from '../components/admin/AdminCockpitView';
import { api, type PlatformMetrics, type PlatformTenantItem } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { useAuthStore } from '../store/auth.store';

const mockMetrics: PlatformMetrics = {
  totalTenants: 12,
  activeTenants: 11,
  suspendedTenants: 1,
  totalUsers: 84,
  totalTickets: 1420,
  aiTokensTotal: {
    used: 8400000,
    cap: 25000000,
  },
  services: {
    mongodb: 'healthy',
    redis: 'healthy',
    pgvector: 'healthy',
    bullmq: 'healthy',
  },
};

const mockTenants: PlatformTenantItem[] = [
  {
    id: 'tenant-acme',
    name: 'Acme Corp',
    slug: 'acme-corp',
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    userCount: 38,
    ticketCount: 842,
    createdAt: '2026-01-15T08:00:00Z',
    quotas: {
      maxSeats: 100,
      rateLimitPerMin: 1200,
      aiTokensMonthly: 10000000,
      vectorStorageLimitMb: 5000,
    },
    aiTokenUsage: { used: 5800000, total: 10000000 },
    features: {
      ai_copilot: true,
      sla_automation: true,
      realtime_chat: true,
      biometrics_2fa: true,
    },
  },
  {
    id: 'tenant-stellar',
    name: 'StellarTech Labs',
    slug: 'stellartech',
    plan: 'PRO',
    status: 'ACTIVE',
    userCount: 18,
    ticketCount: 320,
    createdAt: '2026-03-20T11:30:00Z',
    quotas: {
      maxSeats: 25,
      rateLimitPerMin: 600,
      aiTokensMonthly: 2000000,
      vectorStorageLimitMb: 1000,
    },
    aiTokenUsage: { used: 1600000, total: 2000000 },
    features: {
      ai_copilot: true,
      sla_automation: true,
      realtime_chat: true,
      biometrics_2fa: false,
    },
  },
  {
    id: 'tenant-nexus',
    name: 'Nexus Logistics',
    slug: 'nexus-logistics',
    plan: 'PRO',
    status: 'SUSPENDED',
    userCount: 14,
    ticketCount: 180,
    createdAt: '2026-05-10T14:15:00Z',
    quotas: {
      maxSeats: 20,
      rateLimitPerMin: 600,
      aiTokensMonthly: 2000000,
      vectorStorageLimitMb: 1000,
    },
    aiTokenUsage: { used: 750000, total: 2000000 },
    features: {
      ai_copilot: false,
      sla_automation: true,
      realtime_chat: false,
      biometrics_2fa: false,
    },
  },
  {
    id: 'tenant-devscale',
    name: 'DevScale IO',
    slug: 'devscale',
    plan: 'FREE',
    status: 'ACTIVE',
    userCount: 5,
    ticketCount: 48,
    createdAt: '2026-08-01T09:00:00Z',
    quotas: {
      maxSeats: 5,
      rateLimitPerMin: 120,
      aiTokensMonthly: 500000,
      vectorStorageLimitMb: 250,
    },
    aiTokenUsage: { used: 250000, total: 500000 },
    features: {
      ai_copilot: false,
      sla_automation: false,
      realtime_chat: true,
      biometrics_2fa: false,
    },
  },
];

describe('AdminCockpitView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'owner-root',
        tenantId: 'platform-root',
        email: 'root@supportpilot.io',
        name: 'Super Admin',
        role: 'OWNER',
      },
      isAuthenticated: true,
      accessToken: 'root-token-xyz',
    });

    vi.spyOn(api.admin, 'getMetrics').mockResolvedValue(mockMetrics);
    vi.spyOn(api.admin, 'listTenants').mockResolvedValue(mockTenants);
    vi.spyOn(api.admin, 'updateTenantStatus').mockResolvedValue(undefined);
    vi.spyOn(api.admin, 'updateTenantPlan').mockResolvedValue({
      success: true,
      plan: 'ENTERPRISE',
    });
    vi.spyOn(api.admin, 'updateTenantQuotas').mockResolvedValue({
      success: true,
      quotas: { maxSeats: 150 },
    });
    vi.spyOn(api.admin, 'getTenantAuditLogs').mockResolvedValue([
      {
        id: 'log-1',
        action: 'tenant.plan_upgraded',
        resource: 'billing',
        userEmail: 'root@supportpilot.io',
        createdAt: new Date().toISOString(),
      },
    ]);
  });

  it('renders KPI telemetry cards and tenant directory list', async () => {
    renderWithQueryClient(<AdminCockpitView />);

    // Breadcrumb and title
    expect(screen.getByText('Super Admin Platform Cockpit')).toBeInTheDocument();
    expect(screen.getByText('Platform Root')).toBeInTheDocument();
    expect(screen.getByText('Multi-Tenant Fleet')).toBeInTheDocument();

    // KPI Cards
    await waitFor(() => {
      expect(screen.getByText('Total Tenants')).toBeInTheDocument();
      expect(screen.getByText('11 Active')).toBeInTheDocument();
      expect(screen.getByText('1 Suspended')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Platform Users')).toBeInTheDocument();
    expect(screen.getByText('84')).toBeInTheDocument();

    expect(screen.getByText('Total Tickets Processed')).toBeInTheDocument();
    expect(screen.getByText('1,420')).toBeInTheDocument();

    expect(screen.getByText('AI Token Volume')).toBeInTheDocument();
    expect(screen.getByText('8.4M')).toBeInTheDocument();

    expect(screen.getByText('Infrastructure Telemetry')).toBeInTheDocument();
    expect(screen.getByText('MongoDB')).toBeInTheDocument();
    expect(screen.getByText('PGVector')).toBeInTheDocument();

    // Tenants table rows
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText('StellarTech Labs')).toBeInTheDocument();
    expect(screen.getByText('stellartech')).toBeInTheDocument();
    expect(screen.getByText('Nexus Logistics')).toBeInTheDocument();
    expect(screen.getByText('DevScale IO')).toBeInTheDocument();
  });

  it('filters tenants by search query and plan filter chips', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdminCockpitView />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('tenant-search-input');
    await user.type(searchInput, 'stellar');

    // Only StellarTech should remain visible
    expect(screen.getByText('StellarTech Labs')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.queryByText('Nexus Logistics')).not.toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();

    // Click 'FREE' chip
    const freeChip = screen.getByTestId('filter-free');
    await user.click(freeChip);

    expect(screen.getByText('DevScale IO')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.queryByText('StellarTech Labs')).not.toBeInTheDocument();

    // Click 'ACTIVE ONLY' chip
    const activeChip = screen.getByTestId('filter-active-only');
    await user.click(activeChip);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('StellarTech Labs')).toBeInTheDocument();
    expect(screen.queryByText('Nexus Logistics')).not.toBeInTheDocument();
  });

  it('opens slide-over inspection drawer on clicking Inspect and edits quotas', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdminCockpitView />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    // Click Inspect on Acme Corp
    const inspectBtn = screen.getByTestId('inspect-tenant-tenant-acme');
    await user.click(inspectBtn);

    // Drawer should open with Acme Corp details
    await waitFor(() => {
      expect(screen.getByText('Capacity & Quota Overrides')).toBeInTheDocument();
    });
    expect(screen.getByText('Per-Tenant Feature Flags')).toBeInTheDocument();
    expect(screen.getByText('Recent Security Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();

    // Check inputs
    const maxSeatsInput = screen.getByTestId('input-max-seats');
    expect(maxSeatsInput).toHaveValue(100);

    await user.clear(maxSeatsInput);
    await user.type(maxSeatsInput, '150');

    const saveQuotasBtn = screen.getByTestId('save-quotas-btn');
    await user.click(saveQuotasBtn);

    expect(api.admin.updateTenantQuotas).toHaveBeenCalledWith(
      'tenant-acme',
      expect.objectContaining({ maxSeats: 150 }),
    );

    // Toggle a feature flag in drawer
    const copilotSwitch = screen.getByTestId('toggle-flag-ai_copilot');
    await user.click(copilotSwitch);

    // Close drawer
    const closeBtn = screen.getByTestId('close-drawer-btn');
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Capacity & Quota Overrides')).not.toBeInTheDocument();
    });
  });

  it('toggles tenant status between ACTIVE and SUSPENDED', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdminCockpitView />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    // Acme Corp is currently ACTIVE, so toggle button should say "Suspend"
    const toggleBtn = screen.getByTestId('toggle-status-tenant-acme');
    expect(toggleBtn).toHaveTextContent('Suspend');

    await user.click(toggleBtn);

    expect(api.admin.updateTenantStatus).toHaveBeenCalledWith('tenant-acme', 'SUSPENDED');

    // UI should reflect SUSPENDED
    await waitFor(() => {
      expect(toggleBtn).toHaveTextContent('Activate');
    });
  });

  it('provisions new tenant via modal form', async () => {
    const user = userEvent.setup();
    const provisionSpy = vi.spyOn(api.admin, 'provisionTenant').mockResolvedValueOnce({
      id: 'tenant-quantum',
      name: 'Quantum Systems',
      slug: 'quantum-systems',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      userCount: 1,
      ticketCount: 0,
      createdAt: new Date().toISOString(),
      aiTokenUsage: { used: 0, total: 10000000 },
    });

    renderWithQueryClient(<AdminCockpitView />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    const openModalBtn = screen.getByTestId('provision-tenant-btn');
    await user.click(openModalBtn);

    expect(screen.getByText('Provision New Fleet Tenant')).toBeInTheDocument();

    const nameInput = screen.getByTestId('provision-name-input');
    const slugInput = screen.getByTestId('provision-slug-input');
    const planSelect = screen.getByTestId('provision-plan-select');
    const emailInput = screen.getByTestId('provision-email-input');

    await user.type(nameInput, 'Quantum Systems');
    await user.clear(slugInput);
    await user.type(slugInput, 'quantum-systems');
    await user.selectOptions(planSelect, 'ENTERPRISE');
    await user.type(emailInput, 'admin@quantum.com');

    const submitBtn = screen.getByTestId('submit-provision-btn');
    await user.click(submitBtn);

    expect(provisionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Quantum Systems',
        slug: 'quantum-systems',
        plan: 'ENTERPRISE',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('Quantum Systems')).toBeInTheDocument();
    });
  });
});
