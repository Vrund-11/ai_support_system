import { create } from 'zustand';
import { secureStorage } from './storage.js';
import { biometricService } from './biometrics.js';

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  tenantId: string;
}

export interface AuthState {
  user: MobileUser | null;
  tenantId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isBiometricsEnabled: boolean;
  isBiometricsSupported: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (
    credentials: { email: string; password: string; tenantId?: string },
    apiLoginFn?: Function,
  ) => Promise<boolean>;
  loginWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  setTokens: (accessToken: string, refreshToken: string, user: MobileUser) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tenantId: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isBiometricsEnabled: false,
  isBiometricsSupported: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  setTokens: async (accessToken: string, refreshToken: string, user: MobileUser) => {
    await secureStorage.setItem('access_token', accessToken);
    await secureStorage.setItem('refresh_token', refreshToken);
    await secureStorage.setItem('user_profile', JSON.stringify(user));
    await secureStorage.setItem('tenant_id', user.tenantId);

    set({
      accessToken,
      refreshToken,
      user,
      tenantId: user.tenantId,
      isAuthenticated: true,
      error: null,
    });
  },

  login: async (credentials, apiLoginFn) => {
    set({ isLoading: true, error: null });
    try {
      if (apiLoginFn) {
        const response = await apiLoginFn(credentials);
        await get().setTokens(response.accessToken, response.refreshToken, response.user);
        set({ isLoading: false });
        return true;
      }

      // Default mock login if no API client injected (for testing)
      if (credentials.password === 'invalid-password') {
        throw new Error('Invalid email or password');
      }

      const mockUser: MobileUser = {
        id: 'usr_mobile_agent_1',
        email: credentials.email,
        name: 'Mobile Support Agent',
        role: 'AGENT',
        tenantId: credentials.tenantId || 'tenant_mobile_org',
      };

      await get().setTokens('mock_access_token_jwt', 'mock_refresh_token_jwt', mockUser);
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Login failed. Please check your credentials.',
      });
      return false;
    }
  },

  enableBiometrics: async () => {
    const hasHardware = await biometricService.hasHardwareAsync();
    const isEnrolled = await biometricService.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      set({ error: 'Biometric hardware unavailable or not configured.' });
      return false;
    }

    const authResult = await biometricService.authenticateAsync('Enable Biometric Authentication');
    if (authResult.success) {
      await secureStorage.setItem('biometrics_enabled', 'true');
      set({ isBiometricsEnabled: true, error: null });
      return true;
    }

    set({ error: authResult.error || 'Biometric authentication failed.' });
    return false;
  },

  loginWithBiometrics: async () => {
    set({ isLoading: true, error: null });
    try {
      const isEnabled = (await secureStorage.getItem('biometrics_enabled')) === 'true';
      if (!isEnabled) {
        set({ isLoading: false, error: 'Biometric unlock is not enabled.' });
        return false;
      }

      const authResult = await biometricService.authenticateAsync('Authenticate with Biometrics');
      if (!authResult.success) {
        set({ isLoading: false, error: 'Biometric authentication was cancelled or failed.' });
        return false;
      }

      // Retrieve persisted tokens from secure storage
      const accessToken = await secureStorage.getItem('access_token');
      const refreshToken = await secureStorage.getItem('refresh_token');
      const profileJson = await secureStorage.getItem('user_profile');

      if (!accessToken || !refreshToken || !profileJson) {
        set({ isLoading: false, error: 'Saved session expired. Please log in with credentials.' });
        return false;
      }

      const user: MobileUser = JSON.parse(profileJson);
      set({
        user,
        tenantId: user.tenantId,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Biometric login failed' });
      return false;
    }
  },

  logout: async () => {
    await secureStorage.deleteItem('access_token');
    await secureStorage.deleteItem('refresh_token');
    await secureStorage.deleteItem('user_profile');
    await secureStorage.deleteItem('tenant_id');

    set({
      user: null,
      tenantId: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  restoreSession: async () => {
    try {
      const hasHardware = await biometricService.hasHardwareAsync();
      const isBioEnabled = (await secureStorage.getItem('biometrics_enabled')) === 'true';
      set({ isBiometricsSupported: hasHardware, isBiometricsEnabled: isBioEnabled });

      const accessToken = await secureStorage.getItem('access_token');
      const refreshToken = await secureStorage.getItem('refresh_token');
      const profileJson = await secureStorage.getItem('user_profile');

      if (!accessToken || !refreshToken || !profileJson) {
        return false;
      }

      const user: MobileUser = JSON.parse(profileJson);
      set({
        user,
        tenantId: user.tenantId,
        accessToken,
        refreshToken,
        isAuthenticated: true,
      });
      return true;
    } catch {
      return false;
    }
  },
}));
