import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../src/lib/auth.store.js';
import { secureStorage } from '../src/lib/storage.js';
import { biometricService } from '../src/lib/biometrics.js';

describe('Mobile Auth & Biometric Unlock Store (MOB-1)', () => {
  beforeEach(async () => {
    await secureStorage.clear();
    useAuthStore.setState({
      user: null,
      tenantId: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isBiometricsEnabled: false,
      isBiometricsSupported: false,
      isLoading: false,
      error: null,
    });
    biometricService.setMockState(true, true, true);
  });

  it('logs in agent with credentials, stores JWT tokens in secure storage, and marks authenticated', async () => {
    const success = await useAuthStore.getState().login({
      email: 'agent@supportpilot.io',
      password: 'password123',
      tenantId: 'tenant_mobile_1',
    });

    expect(success).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('agent@supportpilot.io');
    expect(state.tenantId).toBe('tenant_mobile_1');
    expect(state.accessToken).toBe('mock_access_token_jwt');

    // Verify persisted in secureStorage
    const storedToken = await secureStorage.getItem('access_token');
    const storedTenant = await secureStorage.getItem('tenant_id');
    expect(storedToken).toBe('mock_access_token_jwt');
    expect(storedTenant).toBe('tenant_mobile_1');
  });

  it('rejects invalid credentials and captures error message', async () => {
    const success = await useAuthStore.getState().login({
      email: 'bad@example.com',
      password: 'invalid-password',
    });

    expect(success).toBe(false);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toContain('Invalid email or password');
  });

  it('enables biometric authentication when hardware is available and enrolled', async () => {
    const success = await useAuthStore.getState().enableBiometrics();

    expect(success).toBe(true);
    expect(useAuthStore.getState().isBiometricsEnabled).toBe(true);
    expect(await secureStorage.getItem('biometrics_enabled')).toBe('true');
  });

  it('fails biometric enablement if hardware is not available', async () => {
    biometricService.setMockState(false, false, false);

    const success = await useAuthStore.getState().enableBiometrics();
    expect(success).toBe(false);
    expect(useAuthStore.getState().error).toContain('Biometric hardware unavailable');
  });

  it('logs in using biometric unlock after enabling and restoring session', async () => {
    // 1. Initial login
    await useAuthStore.getState().login({ email: 'bio@example.com', password: 'pw' });
    // 2. Enable biometrics
    await useAuthStore.getState().enableBiometrics();

    // 3. App restarts (clear memory state)
    useAuthStore.setState({ isAuthenticated: false, user: null, accessToken: null });

    // 4. Unlock with biometrics
    const unlockSuccess = await useAuthStore.getState().loginWithBiometrics();
    expect(unlockSuccess).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('bio@example.com');
  });

  it('clears all credentials and tokens on logout', async () => {
    await useAuthStore.getState().login({ email: 'logout@example.com', password: 'pw' });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(await secureStorage.getItem('access_token')).toBeNull();
    expect(await secureStorage.getItem('refresh_token')).toBeNull();
  });

  it('refreshes session tokens successfully using refresh token rotation', async () => {
    await useAuthStore.getState().login({ email: 'refresh@example.com', password: 'pw' });
    const originalAccess = useAuthStore.getState().accessToken;
    expect(originalAccess).toBe('mock_access_token_jwt');

    const mockApiRefresh = vi.fn().mockResolvedValue({
      accessToken: 'new_rotated_access_token',
      refreshToken: 'new_rotated_refresh_token',
    });

    const refreshed = await useAuthStore.getState().refreshSession(mockApiRefresh);
    expect(refreshed).toBe(true);
    expect(mockApiRefresh).toHaveBeenCalledWith('mock_refresh_token_jwt');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new_rotated_access_token');
    expect(state.refreshToken).toBe('new_rotated_refresh_token');
    expect(state.isAuthenticated).toBe(true);
    expect(await secureStorage.getItem('access_token')).toBe('new_rotated_access_token');
  });

  it('logs out agent and clears session when refresh token is rejected', async () => {
    await useAuthStore.getState().login({ email: 'rejected@example.com', password: 'pw' });

    const mockApiRefresh = vi.fn().mockRejectedValue(new Error('Invalid refresh token: 401'));

    const refreshed = await useAuthStore.getState().refreshSession(mockApiRefresh);
    expect(refreshed).toBe(false);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(await secureStorage.getItem('access_token')).toBeNull();
  });
});
