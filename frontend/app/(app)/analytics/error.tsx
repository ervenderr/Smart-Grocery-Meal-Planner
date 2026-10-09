'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Analytics page error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-7 w-7 text-red-600" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold text-gray-900">Analytics is unavailable</h1>
      <p className="text-sm text-gray-600">
        Something went wrong while showing your analytics. Your data is safe.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
