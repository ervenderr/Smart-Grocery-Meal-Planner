'use client';

import { AlertTriangle, CloudUpload } from 'lucide-react';
import { openPendingSheet } from '@/lib/offline/status/sheet-store';

interface PendingMarkerProps {
  state: 'pending' | 'failed' | undefined;
}

/** Small per-row status icon for a queued or failed offline change. */
export function PendingMarker({ state }: PendingMarkerProps) {
  if (!state) return null;
  if (state === 'pending') {
    return (
      <span className="inline-flex shrink-0 items-center">
        <CloudUpload className="h-3 w-3 text-gray-500" aria-hidden="true" />
        <span className="sr-only">Waiting to sync</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={openPendingSheet}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <AlertTriangle className="h-3 w-3 text-red-500" aria-hidden="true" />
      <span className="sr-only">Change failed</span>
    </button>
  );
}
