import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '@/types/auth.types';

interface AuthStore extends AuthState {
  setAuth: (token: string, user: User) => void;
  updateUser: (user: User) => void;
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
      setAuth: (token: string, user: User) => {
        // Store token in localStorage for API client
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth-token', token);
        }

        set({
          token,
          user,
          isAuthenticated: true,
        });
      },

      /**
       * Update user data (e.g., after profile update)
       */
      updateUser: (user: User) => {
        set((state) => ({
          user: { ...state.user, ...user } as User,
        }));
      },

      /**
       * Clear authentication data on logout
       */
      clearAuth: () => {
        // Remove token from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-token');
        }

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
