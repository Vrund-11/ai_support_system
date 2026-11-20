import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { AutomationView } from '../components/automation/AutomationView';
import { api } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { mockRule } from './mocks';

describe('AutomationView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders rules tab and lists rules', async () => {
    vi.spyOn(api.automation, 'listRules').mockResolvedValueOnce([mockRule]);

    renderWithQueryClient(<AutomationView />);

    await waitFor(() => {
      expect(screen.getByTestId('rules-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Auto-tag Urgent Tickets')).toBeInTheDocument();
    expect(screen.getByText('TICKET_CREATED')).toBeInTheDocument();
  });

  it('toggles rule enabled status', async () => {
    vi.spyOn(api.automation, 'listRules').mockResolvedValueOnce([mockRule]);
    const toggleSpy = vi.spyOn(api.automation, 'toggleRule').mockResolvedValueOnce({
      ...mockRule,
      enabled: false,
    });

    renderWithQueryClient(<AutomationView />);

    await waitFor(() => {
      expect(screen.getByTestId(`toggle-rule-${mockRule.id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`toggle-rule-${mockRule.id}`));

    await waitFor(() => {
      expect(toggleSpy).toHaveBeenCalledWith(mockRule.id, false);
    });
  });

  it('switches to SLA Policies tab and updates policies', async () => {
    vi.spyOn(api.automation, 'listRules').mockResolvedValueOnce([mockRule]);
    vi.spyOn(api.automation, 'getSlaPolicies').mockResolvedValueOnce({
      URGENT: { firstResponseMin: 15, resolveMin: 120 },
      HIGH: { firstResponseMin: 60, resolveMin: 480 },
      MEDIUM: { firstResponseMin: 240, resolveMin: 1440 },
      LOW: { firstResponseMin: 480, resolveMin: 2880 },
    });
    const updateSpy = vi.spyOn(api.automation, 'updateSlaPolicies').mockResolvedValueOnce({
      URGENT: { firstResponseMin: 20, resolveMin: 120 },
      HIGH: { firstResponseMin: 60, resolveMin: 480 },
      MEDIUM: { firstResponseMin: 240, resolveMin: 1440 },
      LOW: { firstResponseMin: 480, resolveMin: 2880 },
    });

    renderWithQueryClient(<AutomationView />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-sla')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-sla'));

    await waitFor(() => {
      expect(screen.getByTestId('sla-policies-table')).toBeInTheDocument();
    });

    const urgentInput = screen.getByTestId('sla-response-URGENT');
    fireEvent.change(urgentInput, { target: { value: '20' } });

    fireEvent.click(screen.getByTestId('save-sla-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          URGENT: expect.objectContaining({ firstResponseMin: 20 }),
        }),
      );
    });
  });
});
