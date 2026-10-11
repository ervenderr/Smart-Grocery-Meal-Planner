'use client';

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '@/lib/react-query';
import { CurrencyProvider } from '@/lib/currency/currency-provider';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { OfflineBootGate } from '@/components/offline/offline-boot-gate';
import { NavigationRegistrar } from '@/components/platform/navigation-registrar';

/**
 * Application Providers
 * Wraps the app with necessary providers
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NavigationRegistrar />
        <OfflineBootGate>
          <CurrencyProvider>{children}</CurrencyProvider>
        </OfflineBootGate>
        <Toaster
          position="top-right"
          containerStyle={{ top: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
