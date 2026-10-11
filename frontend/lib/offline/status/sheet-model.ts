import type { ConnectivityState } from '../connectivity/connectivity';
import { barrierFor, type OutboxOp } from '../outbox/op-types';
import { canRetry, describeOp, reasonCopy, rowBadge, savedAgo, type RowBadge } from './describe-op';

export interface SheetRow {
  seq: number;
  description: string;
  savedAgo: string;
  badge: RowBadge;
  reason: string | null;
  attempts: number;
  canRetry: boolean;
  canDiscard: boolean;
}

export interface SheetModel {
  summary: string;
  attention: SheetRow[];
  waiting: SheetRow[];
  showRetryAll: boolean;
  showDiscardAll: boolean;
  failedCount: number;
  empty: null | { heading: string; body: string };
}

export interface SheetInput {
  ops: readonly OutboxOp[];
  connectivity: ConnectivityState;
  draining: boolean;
  bootstrapping: boolean;
  now?: number;
}

export const SHEET_COPY = {
  emptyHeading: 'Nothing waiting',
  emptyBody: 'Everything you changed is saved and synced.',
  offlineHeading: "You're offline",
  offlineBody: "You can keep using Kitcha. New changes will show up here and sync when you're back online.",
  downloading: 'Downloading your data...',
  synced: 'All changes are synced.',
} as const;

const changes = (n: number): string => `${n} ${n === 1 ? 'change' : 'changes'}`;

const PARKED = new Set<OutboxOp['state']>(['failed', 'blocked', 'paused_auth']);

/** Earlier parked ops a finish/cook must wait for (the store barrier holds it back until they resolve). */
function parkedBarrierCount(op: OutboxOp, ops: readonly OutboxOp[]): number {
  const types = barrierFor(op.kind);
  if (!types || op.state === 'failed') return 0;
  return ops.filter((o) => o.seq < op.seq && types.includes(o.entityType) && PARKED.has(o.state)).length;
}

function badgeFor(op: OutboxOp, ops: readonly OutboxOp[], now: number): RowBadge {
  const waitingOn = parkedBarrierCount(op, ops);
  if (waitingOn === 0) return rowBadge(op, now);
  return { kind: 'waiting', text: `Waiting on ${waitingOn} failed ${waitingOn === 1 ? 'change' : 'changes'}` };
}

function toRow(op: OutboxOp, now: number, ops: readonly OutboxOp[] = []): SheetRow {
  return {
    seq: op.seq,
    description: describeOp(op),
    savedAgo: savedAgo(op.createdAt, now),
    badge: badgeFor(op, ops, now),
    reason: reasonCopy(op),
    attempts: op.attempts,
    canRetry: canRetry(op),
    canDiscard: op.state === 'failed',
  };
}

function summaryFor(i: SheetInput, pending: number): string {
  if (i.bootstrapping) return SHEET_COPY.downloading;
  if (i.connectivity === 'offline') {
    return pending > 0 ? `Offline. ${changes(pending)} will sync when you're back online.` : "Offline. You're not connected.";
  }
  if (i.draining) return `Syncing ${changes(pending)}...`;
  if (pending > 0) return `${changes(pending)} waiting to sync.`;
  return SHEET_COPY.synced;
}

export function buildSheetModel(input: SheetInput): SheetModel {
  const now = input.now ?? Date.now();
  const sorted = [...input.ops].sort((a, b) => a.seq - b.seq);
  const failed = sorted.filter((o) => o.state === 'failed');
  const open = sorted.filter((o) => o.state !== 'failed');
  const offline = input.connectivity === 'offline';
  const hasBackoff = open.some((o) => o.state === 'queued' && o.nextAttemptAt > now);
  const empty =
    sorted.length > 0
      ? null
      : offline
        ? { heading: SHEET_COPY.offlineHeading, body: SHEET_COPY.offlineBody }
        : { heading: SHEET_COPY.emptyHeading, body: SHEET_COPY.emptyBody };
  return {
    summary: summaryFor(input, open.length),
    attention: failed.map((o) => toRow(o, now, sorted)),
    waiting: open.map((o) => toRow(o, now, sorted)),
    showRetryAll: !offline && (failed.some(canRetry) || hasBackoff),
    showDiscardAll: failed.length > 0,
    failedCount: failed.length,
    empty,
  };
}
