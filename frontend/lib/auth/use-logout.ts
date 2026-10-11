'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api/auth';
import { getRefreshToken } from '@/lib/api/token-storage';
import { useAuthStore } from '@/lib/stores/auth-store';
import { setSessionEndIntent } from '@/lib/offline/session/session-hooks';

/** Shared logout flow: server logout, clear local auth, redirect to login. */
export function useLogout(): () => Promise<void> {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useCallback(async () => {
    try {
      await authApi.logout(getRefreshToken() ?? undefined);
      setSessionEndIntent('logout');
      clearAuth();
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Clear auth anyway
      setSessionEndIntent('logout');
      clearAuth();
      router.push('/login');
    }
  }, [clearAuth, router]);
}
