import type { ConnectivityState } from '../connectivity/connectivity';

export type IndicatorState = 'attention' | 'syncing' | 'offline' | 'pending' | 'just-synced' | 'synced';

export interface IndicatorCounts {
  queued: number;
  inFlight: number;
  failed: number;
  blocked: number;
  pausedAuth: number;
}

export interface IndicatorView {
  state: IndicatorState;
  label: string | null;
  ariaLabel: string;
  visible: boolean;
  count: number;
}

export interface IndicatorInput {
  connectivity: ConnectivityState;
  draining: boolean;
  counts: IndicatorCounts;
  justSynced: boolean;
}

const OPEN = 'Open pending changes';

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export function pendingCount(c: IndicatorCounts): number {
  return c.queued + c.inFlight + c.blocked + c.pausedAuth;
}

export function deriveIndicator(input: IndicatorInput): IndicatorView {
  const { connectivity, draining, counts, justSynced } = input;
  const pending = pendingCount(counts);
  const failed = counts.failed;
  const waiting = `${pending} ${plural(pending, 'change', 'changes')} waiting to sync`;

  if (failed > 0) {
    return {
      state: 'attention',
      label: `${failed} need attention`,
      ariaLabel: `${failed} ${plural(failed, 'change needs', 'changes need')} attention. ${OPEN}`,
      visible: true,
      count: failed,
    };
  }
  if (draining) {
    return {
      state: 'syncing',
      label: `Syncing ${pending}`,
      ariaLabel: `Syncing ${pending} ${plural(pending, 'change', 'changes')}. ${OPEN}`,
      visible: true,
      count: pending,
    };
  }
  if (connectivity === 'offline') {
    return {
      state: 'offline',
      label: pending > 0 ? `Offline · ${pending} pending` : 'Offline',
      ariaLabel: pending > 0 ? `Offline, ${waiting}. ${OPEN}` : `Offline. ${OPEN}`,
      visible: true,
      count: pending,
    };
  }
  if (pending > 0) {
    return {
      state: 'pending',
      label: `${pending} pending`,
      ariaLabel: `${waiting}. ${OPEN}`,
      visible: true,
      count: pending,
    };
  }
  if (justSynced) {
    return { state: 'just-synced', label: 'All synced', ariaLabel: `All changes synced. ${OPEN}`, visible: true, count: 0 };
  }
  return { state: 'synced', label: null, ariaLabel: 'All changes synced', visible: false, count: 0 };
}
