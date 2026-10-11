import type { ConnectivityState } from '../connectivity/connectivity';
import type { DrainEvent } from '../outbox/drain';
import type { OutboxOp } from '../outbox/op-types';
import type { OfflineRuntime } from '../runtime';
import { pendingCount, type IndicatorCounts } from './derive-indicator';

export const JUST_SYNCED_MS = 2000;
export const ANNOUNCE_DEBOUNCE_MS = 500;

export interface StatusSnapshot {
  readonly ops: readonly OutboxOp[];
  readonly counts: IndicatorCounts;
  readonly connectivity: ConnectivityState;
  readonly draining: boolean;
  readonly justSynced: boolean;
  /** Debounced pending count, for the aria-live region only. */
  readonly announcedCount: number;
}

export interface StatusSource {
  subscribe(cb: () => void): () => void;
  getSnapshot(): StatusSnapshot;
}

type SourceRuntime = Pick<OfflineRuntime, 'store' | 'connectivity' | 'drain' | 'onEvent'>;

export function countOps(ops: readonly OutboxOp[]): IndicatorCounts {
  const c = { queued: 0, inFlight: 0, failed: 0, blocked: 0, pausedAuth: 0 };
  for (const op of ops) {
    if (op.state === 'queued') c.queued += 1;
    else if (op.state === 'in_flight') c.inFlight += 1;
    else if (op.state === 'failed') c.failed += 1;
    else if (op.state === 'blocked') c.blocked += 1;
    else if (op.state === 'paused_auth') c.pausedAuth += 1;
  }
  return c;
}

export function createStatusSource(runtime: SourceRuntime, getUserId: () => string | null): StatusSource {
  const listeners = new Set<() => void>();
  let snapshot: StatusSnapshot = {
    ops: [],
    counts: countOps([]),
    connectivity: runtime.connectivity.getState(),
    draining: runtime.drain.isDraining(),
    justSynced: false,
    announcedCount: 0,
  };
  let detach: (() => void) | null = null;
  let justSyncedTimer: ReturnType<typeof setTimeout> | null = null;
  let announceTimer: ReturnType<typeof setTimeout> | null = null;

  const commit = (patch: Partial<StatusSnapshot>): void => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((l) => l());
  };

  const scheduleAnnounce = (): void => {
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      announceTimer = null;
      const n = pendingCount(snapshot.counts);
      if (n !== snapshot.announcedCount) commit({ announcedCount: n });
    }, ANNOUNCE_DEBOUNCE_MS);
  };

  const refresh = async (): Promise<void> => {
    const userId = getUserId();
    let ops: OutboxOp[] = [];
    if (userId) {
      try {
        ops = await runtime.store.list(userId);
      } catch {
        return;
      }
    }
    if (!detach) return;
    commit({ ops, counts: countOps(ops) });
    scheduleAnnounce();
  };

  const flashSynced = (): void => {
    if (justSyncedTimer) clearTimeout(justSyncedTimer);
    commit({ justSynced: true });
    justSyncedTimer = setTimeout(() => {
      justSyncedTimer = null;
      commit({ justSynced: false });
    }, JUST_SYNCED_MS);
  };

  const onEvent = (e: DrainEvent): void => {
    if (e.type === 'started') commit({ draining: true });
    if (e.type !== 'finished') return;
    commit({ draining: false });
    void refresh().then(() => {
      if (pendingCount(snapshot.counts) + snapshot.counts.failed === 0) flashSynced();
    });
  };

  const attach = (): (() => void) => {
    const offs = [
      runtime.store.subscribe(() => void refresh()),
      runtime.connectivity.subscribe((connectivity) => commit({ connectivity })),
      runtime.onEvent(onEvent),
    ];
    return () => {
      offs.forEach((off) => off());
      if (justSyncedTimer) clearTimeout(justSyncedTimer);
      if (announceTimer) clearTimeout(announceTimer);
      justSyncedTimer = null;
      announceTimer = null;
    };
  };

  return {
    subscribe(cb) {
      listeners.add(cb);
      if (!detach) {
        detach = attach();
        void refresh();
      }
      return () => {
        listeners.delete(cb);
        if (listeners.size === 0 && detach) {
          detach();
          detach = null;
        }
      };
    },
    getSnapshot: () => snapshot,
  };
}
