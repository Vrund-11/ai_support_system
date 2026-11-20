import { create } from 'zustand';
import type { UserDto } from '@supportpilot/shared-types';

interface AuthState {
  accessToken: string | null;
  user: UserDto | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserDto) => void;
  clearAuth: () => void;
}

const STORAGE_KEY_TOKEN = 'supportpilot_token';
const STORAGE_KEY_USER = 'supportpilot_user';

function loadInitialState(): { token: string | null; user: UserDto | null } {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const userJson = localStorage.getItem(STORAGE_KEY_USER);
    if (token && userJson) {
      const user = JSON.parse(userJson) as UserDto;
      return { token, user };
    }
  } catch {
    // Ignore storage parse errors
  }
  return { token: null, user: null };
}

const initial = loadInitialState();

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initial.token,
  user: initial.user,
  isAuthenticated: Boolean(initial.token && initial.user),
  setAuth: (token: string, user: UserDto) => {
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch {
      // Ignore storage errors
    }
    set({
      accessToken: token,
      user,
      isAuthenticated: true,
    });
  },
  clearAuth: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
    } catch {
      // Ignore storage errors
    }
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
