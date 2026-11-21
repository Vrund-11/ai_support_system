import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, render, waitFor } from '@testing-library/react';
import { Shell } from '../components/layout/Shell';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';
import { mockUser, mockNotification } from './mocks';

describe('Shell Component', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token123' });
    vi.restoreAllMocks();
    vi.spyOn(api.notifications, 'list').mockResolvedValue([mockNotification]);
  });

  it('renders navigation tabs including Customers, Team, and Automation', async () => {
    const onNavigateTab = vi.fn();
    render(
      <Shell
        activeTab="inbox"
        onOpenCreateModal={vi.fn()}
        onNavigateInbox={vi.fn()}
        onNavigateTab={onNavigateTab}
      >
        <div>Content</div>
      </Shell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('nav-customers')).toBeInTheDocument();
    });
    expect(screen.getByTestId('nav-team')).toBeInTheDocument();
    expect(screen.getByTestId('nav-automation')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('nav-customers'));
    expect(onNavigateTab).toHaveBeenCalledWith('customers');

    fireEvent.click(screen.getByTestId('nav-team'));
    expect(onNavigateTab).toHaveBeenCalledWith('team');

    fireEvent.click(screen.getByTestId('nav-automation'));
    expect(onNavigateTab).toHaveBeenCalledWith('automation');
  });

  it('toggles dark mode class and persists to localStorage', async () => {
    render(
      <Shell activeTab="inbox" onOpenCreateModal={vi.fn()} onNavigateInbox={vi.fn()}>
        <div>Content</div>
      </Shell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dark-mode-toggle')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId('dark-mode-toggle');
    fireEvent.click(toggleBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('supportpilot_theme')).toBe('dark');

    fireEvent.click(toggleBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('supportpilot_theme')).toBe('light');
  });
});
