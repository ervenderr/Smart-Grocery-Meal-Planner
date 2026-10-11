'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/stores/auth-store';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { isNative } from '@/lib/platform/native';
import { SIGNED_OUT_COPY, whenTokenStorageReady } from '@/lib/api/token-storage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protected Route Component
 * Wraps pages that require authentication
 * Waits for secure token hydration, then redirects to login if not authenticated
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const toLogin = () => {
      if (isNative()) router.replace('/login');
      else router.push('/login');
    };

    void whenTokenStorageReady().then(({ readFailed }) => {
      if (cancelled) return;
      if (readFailed) {
        toast.error(SIGNED_OUT_COPY, { id: 'signed-out' });
        toLogin();
        return;
      }
      // Wait for hydration to complete before checking auth
      timer = setTimeout(() => {
        if (cancelled) return;
        const state = useAuthStore.getState();
        if (!state.isAuthenticated || !state.token) {
          toLogin();
        } else {
          setIsLoading(false);
        }
      }, 100);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated, token, router]);

  // Show loading while checking auth and hydrating
  if (isLoading || !isAuthenticated || !token) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
