import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '@/types/auth.types';
import { queryClient } from '@/lib/react-query';
import { clearUserSessionState } from '@/lib/auth/session-cleanup';
import { clearTokens, setTokens } from '@/lib/api/token-storage';

function resetUserSessionState(): void {
  clearUserSessionState(
    queryClient,
    typeof window !== 'undefined' ? window.sessionStorage : undefined,
    typeof window !== 'undefined' ? window.localStorage : undefined
  );
}

interface AuthStore extends AuthState {
  setAuth: (token: string, user: User, refreshToken?: string) => void;
  updateUser: (user: Partial<User>) => void;
  clearAuth: () => void;
}

/**
 * Authentication Store
 * Manages authentication state with persistence
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      /**
       * Set authentication data after login/signup
       */
      setAuth: (token: string, user: User, refreshToken?: string) => {
        // A new session must never inherit cached data from a previous user
        resetUserSessionState();
        // Store tokens in localStorage for API client (refresh token is not in zustand state)
        setTokens({ token, refreshToken });

        set({
          token,
          user,
          isAuthenticated: true,
        });
      },

      /**
       * Update user data (e.g., after profile update)
       * Accepts partial user data and merges with existing user
       */
      updateUser: (user: Partial<User>) => {
        set((state) => ({
          user: { ...state.user, ...user } as User,
        }));
      },

      /**
       * Clear authentication data on logout
       */
      clearAuth: () => {
        // Drop every cached query and per-user browser state
        resetUserSessionState();
        // Remove access and refresh tokens from localStorage
        clearTokens();

        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
