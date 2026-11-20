import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/auth.store';
import { mockUser } from './mocks';

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clearAuth();
  });

  it('initializes as unauthenticated when storage is empty', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('sets authentication state and updates localStorage', () => {
    useAuthStore.getState().setAuth('mock_jwt_token', mockUser);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('mock_jwt_token');
    expect(state.user).toEqual(mockUser);
    expect(localStorage.getItem('supportpilot_token')).toBe('mock_jwt_token');
  });

  it('clears authentication state and removes localStorage items', () => {
    useAuthStore.getState().setAuth('mock_jwt_token', mockUser);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(localStorage.getItem('supportpilot_token')).toBeNull();
  });
});
