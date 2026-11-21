import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { useAdminAuthStore } from '../store/admin-auth.store';
import { adminApi } from '../lib/admin-api';

describe('SupportPilot SuperAdmin Application (apps/admin)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAdminAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
    vi.restoreAllMocks();
  });

  it('1) Login form authentication: requires superadmin credentials and grants root access', async () => {
    render(<App />);

    // Login form is displayed
    expect(screen.getByTestId('admin-login-form')).toBeInTheDocument();
    expect(screen.getByText(/NOC SECURE ZONE/i)).toBeInTheDocument();
    expect(screen.getByText(/PORT 3001/i)).toBeInTheDocument();

    const emailInput = screen.getByTestId('admin-email-input');
    const passwordInput = screen.getByTestId('admin-password-input');
    const submitBtn = screen.getByTestId('admin-login-submit');

    // Wrong credentials
    fireEvent.change(emailInput, { target: { value: 'wrong@admin.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPass!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('admin-login-error')).toBeInTheDocument();
    });

    // Valid credentials
    fireEvent.change(emailInput, { target: { value: 'admin@supportpilot.io' } });
    fireEvent.change(passwordInput, { target: { value: 'SuperAdminSecret2026!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('port-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('root-access-badge')).toBeInTheDocument();
    });
  });

  describe('Authenticated SuperAdmin Console', () => {
    beforeEach(() => {
      useAdminAuthStore.setState({
        token: 'mock-superadmin-token',
        user: { email: 'admin@supportpilot.io', role: 'SUPERADMIN', name: 'Platform Root' },
        isAuthenticated: true,
      });
    });

    it('2) Navigation across Overview, Registrations, Subscriptions, Tenants, and Audit tabs', async () => {
      render(<App />);

      // Verify NOC Header Badges
      expect(screen.getByTestId('port-indicator')).toHaveTextContent('PORT: 3001');
      expect(screen.getByTestId('root-access-badge')).toHaveTextContent('ROOT ACCESS');

      // 1. Overview tab (default)
      await waitFor(() => {
        expect(screen.getByTestId('kpi-mrr')).toBeInTheDocument();
      });
      expect(screen.getByTestId('kpi-tenants')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-users')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-tickets')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-ai-pool')).toBeInTheDocument();
      expect(screen.getByTestId('telemetry-mongodb')).toBeInTheDocument();
      expect(screen.getByTestId('telemetry-redis')).toBeInTheDocument();
      expect(screen.getByTestId('telemetry-pgvector')).toBeInTheDocument();
      expect(screen.getByTestId('telemetry-bullmq')).toBeInTheDocument();

      // 2. Navigate to Registrations
      fireEvent.click(screen.getByTestId('tab-registrations'));
      await waitFor(() => {
        expect(screen.getByText(/New Organization Registrations/i)).toBeInTheDocument();
      });
      expect(screen.getByTestId('registrations-search')).toBeInTheDocument();

      // 3. Navigate to Subscriptions
      fireEvent.click(screen.getByTestId('tab-subscriptions'));
      await waitFor(() => {
        expect(screen.getByText(/Paid Subscriptions & MRR Breakdown/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/STRIPE CONNECTED/i)).toBeInTheDocument();

      // 4. Navigate to Tenants
      fireEvent.click(screen.getByTestId('tab-tenants'));
      await waitFor(() => {
        expect(screen.getByText(/Tenant Fleet Management/i)).toBeInTheDocument();
      });
      expect(screen.getByTestId('tenants-search')).toBeInTheDocument();

      // 5. Navigate to Audit
      fireEvent.click(screen.getByTestId('tab-audit'));
      await waitFor(() => {
        expect(screen.getByText(/Platform Security Audit Trail/i)).toBeInTheDocument();
      });
    });

    it('3) Searching and filtering in Registrations and Tenants views', async () => {
      render(<App />);

      // Check Registrations search
      fireEvent.click(screen.getByTestId('tab-registrations'));
      await waitFor(() => {
        expect(screen.getByTestId('reg-row-reg-001')).toBeInTheDocument();
      });
      expect(screen.getByText('Acme Robotics')).toBeInTheDocument();
      expect(screen.getByText('Nexus BioHealth')).toBeInTheDocument();

      const regSearch = screen.getByTestId('registrations-search');
      fireEvent.change(regSearch, { target: { value: 'Acme' } });

      await waitFor(() => {
        expect(screen.getByText('Acme Robotics')).toBeInTheDocument();
        expect(screen.queryByText('Nexus BioHealth')).not.toBeInTheDocument();
      });

      // Check Tenants search and tier filtering
      fireEvent.click(screen.getByTestId('tab-tenants'));
      await waitFor(() => {
        expect(screen.getByTestId('tenant-row-t-101')).toBeInTheDocument();
      });
      expect(screen.getByText('Acme Robotics')).toBeInTheDocument();
      expect(screen.getByText('SwiftCart Commerce')).toBeInTheDocument();

      // Search tenant name
      const tenantSearch = screen.getByTestId('tenants-search');
      fireEvent.change(tenantSearch, { target: { value: 'Vanguard' } });
      await waitFor(() => {
        expect(screen.getByText('Vanguard Labs Inc')).toBeInTheDocument();
        expect(screen.queryByText('Acme Robotics')).not.toBeInTheDocument();
      });

      // Clear search
      fireEvent.change(tenantSearch, { target: { value: '' } });

      // Filter by FREE tier
      fireEvent.click(screen.getByTestId('filter-tier-free'));
      await waitFor(() => {
        expect(screen.getByText('SwiftCart Commerce')).toBeInTheDocument();
        expect(screen.queryByText('Vanguard Labs Inc')).not.toBeInTheDocument();
      });

      // Filter by SUSPENDED status
      fireEvent.click(screen.getByTestId('filter-tier-all'));
      fireEvent.click(screen.getByTestId('filter-status-suspended'));
      await waitFor(() => {
        expect(screen.getByText('Helios FinTech')).toBeInTheDocument();
        expect(screen.queryByText('Acme Robotics')).not.toBeInTheDocument();
      });
    });

    it('4) Tenant suspend/activate action and quota drawer', async () => {
      vi.spyOn(adminApi, 'updateTenantStatus').mockResolvedValue({
        id: 't-101',
        status: 'SUSPENDED',
      });
      vi.spyOn(adminApi, 'updateTenantQuotas').mockResolvedValue({
        id: 't-101',
        quotas: {
          maxSeats: 120,
          rateLimitPerMin: 1500,
          aiTokensMonthly: 30000000,
          vectorStorageLimitMb: 6000,
        },
      });

      render(<App />);

      fireEvent.click(screen.getByTestId('tab-tenants'));
      await waitFor(() => {
        expect(screen.getByTestId('tenant-row-t-101')).toBeInTheDocument();
      });

      // Open drawer for Acme Robotics
      fireEvent.click(screen.getByTestId('inspect-tenant-t-101'));

      await waitFor(() => {
        expect(screen.getByTestId('tenant-inspection-drawer')).toBeInTheDocument();
      });

      // Verify toggle button says "Suspend Tenant Access" for ACTIVE tenant
      const statusBtn = screen.getByTestId('drawer-status-toggle');
      expect(statusBtn).toHaveTextContent(/Suspend Tenant Access/i);

      // Click to suspend
      fireEvent.click(statusBtn);

      await waitFor(() => {
        expect(adminApi.updateTenantStatus).toHaveBeenCalledWith('t-101', 'SUSPENDED');
        expect(statusBtn).toHaveTextContent(/Activate Tenant Access/i);
      });

      // Update quota seats and save
      const seatsInput = screen.getByTestId('quota-max-seats');
      fireEvent.change(seatsInput, { target: { value: '120' } });

      const saveQuotasBtn = screen.getByTestId('save-quotas-btn');
      fireEvent.click(saveQuotasBtn);

      await waitFor(() => {
        expect(adminApi.updateTenantQuotas).toHaveBeenCalled();
        expect(screen.getByText(/Quotas updated successfully in cluster!/i)).toBeInTheDocument();
      });

      // Close drawer
      fireEvent.click(screen.getByTestId('close-drawer-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('tenant-inspection-drawer')).not.toBeInTheDocument();
      });
    });
  });
});
