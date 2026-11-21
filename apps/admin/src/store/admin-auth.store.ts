import { create } from 'zustand';
import { adminApi, type SuperAdminUser } from '../lib/admin-api';

const TOKEN_KEY = 'supportpilot_superadmin_token';
const USER_KEY = 'supportpilot_superadmin_user';

interface AdminAuthState {
  token: string | null;
  user: SuperAdminUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  initialize: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  user:
    typeof window !== 'undefined' && localStorage.getItem(USER_KEY)
      ? JSON.parse(localStorage.getItem(USER_KEY) as string)
      : null,
  isAuthenticated: typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY),

  initialize: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token) {
      let user: SuperAdminUser = { email: 'admin@supportpilot.io', role: 'SUPERADMIN' };
      if (userJson) {
        try {
          user = JSON.parse(userJson);
        } catch {
          // ignore
        }
      }
      set({ token, user, isAuthenticated: true });
    }
  },

  login: async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await adminApi.login(email, password);
      if (res && res.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        }
        set({ token: res.token, user: res.user, isAuthenticated: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error('SuperAdmin login failed:', err);
      return false;
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
