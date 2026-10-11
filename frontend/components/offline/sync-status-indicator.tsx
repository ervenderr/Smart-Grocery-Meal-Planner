'use client';

import { AlertTriangle, Check, CloudUpload, RefreshCw, WifiOff, type LucideIcon } from 'lucide-react';
import { haptic } from '@/lib/native/native-haptics';
import { deriveIndicator, type IndicatorState } from '@/lib/offline/status/derive-indicator';
import { openPendingSheet } from '@/lib/offline/status/sheet-store';
import { useOfflineStatus } from '@/lib/offline/status/use-offline-status';

const ICONS: Record<IndicatorState, LucideIcon | null> = {
  attention: AlertTriangle,
  syncing: RefreshCw,
  offline: WifiOff,
  pending: CloudUpload,
  'just-synced': Check,
  synced: null,
};

const COLORS: Record<IndicatorState, string> = {
  attention: 'bg-red-50 text-red-800',
  syncing: 'bg-primary-50 text-primary-700',
  offline: 'bg-amber-100 text-amber-900',
  pending: 'bg-amber-100 text-amber-900',
  'just-synced': 'bg-gray-100 text-gray-700',
  synced: '',
};

function announce(state: IndicatorState, count: number): string {
  const changes = `${count} ${count === 1 ? 'change' : 'changes'}`;
  switch (state) {
    case 'attention':
      return `${changes} need attention`;
    case 'syncing':
      return `Syncing ${changes}`;
    case 'offline':
      return count > 0 ? `Offline, ${changes} waiting to sync` : 'Offline';
    case 'pending':
      return `${changes} waiting to sync`;
    case 'just-synced':
      return 'All changes synced';
    default:
      return '';
  }
}

export function SyncStatusIndicator() {
  const status = useOfflineStatus();
  if (!status) return null;

  const view = deriveIndicator({
    connectivity: status.connectivity,
    draining: status.draining,
    counts: status.counts,
    justSynced: status.justSynced,
  });
  const announcement = view.visible ? announce(view.state, status.announcedCount) : '';

  if (!view.visible) {
    return <span role="status" aria-live="polite" className="sr-only" />;
  }
  const Icon = ICONS[view.state];

  return (
    <>
      <button
        type="button"
        aria-label={view.ariaLabel}
        onClick={() => {
          haptic('light');
          openPendingSheet();
        }}
        className="touch-target flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span className={`inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold ${COLORS[view.state]}`}>
          {Icon && (
            <Icon
              className={`h-4 w-4 shrink-0 ${view.state === 'syncing' ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
          )}
          <span aria-hidden="true">{view.label}</span>
        </span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
