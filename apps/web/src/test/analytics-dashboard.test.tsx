import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { api } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { useAuthStore } from '../store/auth.store';

describe('AnalyticsDashboard Component (ANL-1..4: S3-T07)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user_agent_001',
        tenantId: 'tenant_alpha_111',
        email: 'lead@example.com',
        name: 'Lead Agent',
        role: 'LEAD',
      },
      isAuthenticated: true,
      accessToken: 'test-token',
    });
  });

  it('renders dashboard with KPI cards, volume chart, SLA percentiles, and agent performance table', async () => {
    vi.spyOn(api.analytics, 'getOverview').mockResolvedValueOnce({
      open: 18,
      newToday: 7,
      medianFirstResponseMin: 10.5,
      medianResolutionMin: 36.0,
      slaCompliance: 0.96,
      deflectionRate: 0.44,
    });

    vi.spyOn(api.analytics, 'getVolume').mockResolvedValueOnce({
      rangeDays: 7,
      totalTickets: 50,
      byCategory: [
        { category: 'billing', count: 20 },
        { category: 'bug', count: 15 },
      ],
      byPriority: [
        { priority: 'MEDIUM', count: 30 },
        { priority: 'HIGH', count: 20 },
      ],
      byStatus: [
        { status: 'OPEN', count: 18 },
        { status: 'RESOLVED', count: 32 },
      ],
      timeline: [{ date: '2026-11-20', created: 7, resolved: 6 }],
    });

    vi.spyOn(api.analytics, 'getSla').mockResolvedValueOnce({
      rangeDays: 7,
      totalEvaluated: 50,
      breachedCount: 2,
      complianceRate: 0.96,
      firstResponseTimeMin: { p50: 10.5, p90: 24.0, p99: 48.0 },
      resolutionTimeMin: { p50: 36.0, p90: 85.0, p99: 160.0 },
    });

    vi.spyOn(api.analytics, 'getAgents').mockResolvedValueOnce({
      rangeDays: 7,
      agents: [
        {
          agentId: 'user-001',
          name: 'Sarah Connor',
          email: 'sarah@supportpilot.io',
          assignedCount: 25,
          resolvedCount: 24,
          avgResolutionTimeMin: 32.5,
          slaComplianceRate: 0.96,
        },
      ],
    });

    vi.spyOn(api.analytics, 'getDeflection').mockResolvedValueOnce({
      rangeDays: 7,
      totalInquiries: 150,
      botResolvedCount: 66,
      humanEscalatedCount: 84,
      deflectionRate: 0.44,
    });

    renderWithQueryClient(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    });

    // Check KPIs
    expect(screen.getByTestId('kpi-open')).toHaveTextContent('18');
    expect(screen.getByTestId('kpi-sla')).toHaveTextContent('96%');
    expect(screen.getByTestId('kpi-deflection')).toHaveTextContent('44%');
    expect(screen.getByTestId('kpi-response-time')).toHaveTextContent('10.5m');

    // Check Category Breakdown
    expect(screen.getByTestId('category-breakdown')).toBeInTheDocument();
    expect(screen.getByText('billing')).toBeInTheDocument();

    // Check Agent Table
    expect(screen.getByTestId('agent-performance-table')).toBeInTheDocument();
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('32.5 min')).toBeInTheDocument();
  });

  it('switches time range and reloads metrics when 30 Days clicked', async () => {
    const user = userEvent.setup();

    const getOverviewSpy = vi.spyOn(api.analytics, 'getOverview').mockResolvedValue({
      open: 14,
      newToday: 4,
      medianFirstResponseMin: 12.0,
      medianResolutionMin: 40.0,
      slaCompliance: 0.95,
      deflectionRate: 0.4,
    });
    vi.spyOn(api.analytics, 'getVolume').mockResolvedValue({
      rangeDays: 30,
      totalTickets: 120,
      byCategory: [],
      byPriority: [],
      byStatus: [],
      timeline: [],
    });
    vi.spyOn(api.analytics, 'getSla').mockResolvedValue({
      rangeDays: 30,
      totalEvaluated: 120,
      breachedCount: 6,
      complianceRate: 0.95,
      firstResponseTimeMin: { p50: 12, p90: 25, p99: 50 },
      resolutionTimeMin: { p50: 40, p90: 90, p99: 180 },
    });
    vi.spyOn(api.analytics, 'getAgents').mockResolvedValue({ rangeDays: 30, agents: [] });
    vi.spyOn(api.analytics, 'getDeflection').mockResolvedValue({
      rangeDays: 30,
      totalInquiries: 200,
      botResolvedCount: 80,
      humanEscalatedCount: 120,
      deflectionRate: 0.4,
    });

    renderWithQueryClient(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('range-30')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('range-30'));

    await waitFor(() => {
      expect(getOverviewSpy).toHaveBeenCalledWith(30);
    });
  });
});
