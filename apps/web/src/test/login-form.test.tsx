import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../components/auth/LoginForm';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { mockUser } from './mocks';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('renders email and password inputs and submit button', () => {
    render(<LoginForm onSwitchToRegister={vi.fn()} />);

    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-button')).toBeInTheDocument();
  });

  it('authenticates user and stores credentials on valid submission', async () => {
    vi.spyOn(api.auth, 'login').mockResolvedValueOnce({
      accessToken: 'test_token',
      user: mockUser,
    });

    render(<LoginForm onSwitchToRegister={vi.fn()} />);

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'agent@supportpilot.io' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().accessToken).toBe('test_token');
    });
  });

  it('displays error banner when authentication fails', async () => {
    vi.spyOn(api.auth, 'login').mockRejectedValueOnce(
      new ApiError(401, 'Unauthorized', 'Invalid credentials'),
    );

    render(<LoginForm onSwitchToRegister={vi.fn()} />);

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'wrong@supportpilot.io' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'wrongpassword' },
    });

    fireEvent.click(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('login-error')).toHaveTextContent('Invalid credentials');
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
