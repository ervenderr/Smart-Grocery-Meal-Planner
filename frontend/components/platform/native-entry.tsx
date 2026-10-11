'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { whenTokenStorageReady } from '@/lib/api/token-storage';
import { LoadingSpinner } from '@/components/common/loading-spinner';

/** Native `/`: routes by auth state instead of rendering the web landing page. */
export function NativeEntry() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void whenTokenStorageReady().then(() => {
      if (cancelled) return;
      if (process.env.NEXT_PUBLIC_E2E === '1') {
        router.replace('/e2e/');
        return;
      }
      const { isAuthenticated, token } = useAuthStore.getState();
      router.replace(isAuthenticated && token ? '/dashboard/' : '/login/');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex h-dvh items-center justify-center bg-gray-50">
      <LoadingSpinner size="lg" />
    </div>
  );
}
