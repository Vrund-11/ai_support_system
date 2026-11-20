import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { api } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { mockNotification } from './mocks';

describe('NotificationBell Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders bell button and badge when unread notifications exist', async () => {
    vi.spyOn(api.notifications, 'list').mockResolvedValueOnce([mockNotification]);

    renderWithQueryClient(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();
    });

    expect(screen.getByTestId('unread-badge')).toHaveTextContent('1');
  });

  it('toggles dropdown and marks notification as read when clicked', async () => {
    vi.spyOn(api.notifications, 'list').mockResolvedValueOnce([mockNotification]);
    const markReadSpy = vi.spyOn(api.notifications, 'markAsRead').mockResolvedValueOnce();

    renderWithQueryClient(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-bell-btn')).toBeInTheDocument();
    });

    // Open dropdown
    fireEvent.click(screen.getByTestId('notification-bell-btn'));
    expect(screen.getByTestId('notifications-dropdown')).toBeInTheDocument();
    expect(screen.getByText('New ticket assigned')).toBeInTheDocument();

    // Click item to mark read
    fireEvent.click(screen.getByTestId(`notification-item-${mockNotification.id}`));
    await waitFor(() => {
      expect(markReadSpy).toHaveBeenCalledWith(mockNotification.id);
    });
  });

  it('marks all notifications as read', async () => {
    vi.spyOn(api.notifications, 'list').mockResolvedValueOnce([mockNotification]);
    const markAllSpy = vi.spyOn(api.notifications, 'markAllAsRead').mockResolvedValueOnce();

    renderWithQueryClient(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-bell-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('notification-bell-btn'));
    expect(screen.getByTestId('mark-all-read-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mark-all-read-btn'));
    await waitFor(() => {
      expect(markAllSpy).toHaveBeenCalled();
    });
  });
});
