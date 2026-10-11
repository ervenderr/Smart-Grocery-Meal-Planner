'use client';

import { WifiOff } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';

interface FirstLaunchOfflineProps {
  onRetry: () => void;
}

/** Shown when signed in, offline, and nothing has been cached yet (UI-SPEC section 6). */
export function FirstLaunchOffline({ onRetry }: FirstLaunchOfflineProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 pt-safe pb-safe">
      <EmptyState
        icon={WifiOff}
        title="Connect once to get started"
        description="Kitcha needs an internet connection the first time to download your data."
        actionLabel="Try again"
        onAction={onRetry}
      />
    </div>
  );
}
