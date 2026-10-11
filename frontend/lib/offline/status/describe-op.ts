import type { OutboxOp } from '../outbox/op-types';
import { MAX_TRANSIENT_ATTEMPTS } from '../outbox/classify-error';
import { relativeTimeAgo } from '@/lib/rules/relative-time';

export type RowBadgeKind = 'waiting' | 'syncing' | 'retrying' | 'failed' | 'conflict';
export interface RowBadge {
  kind: RowBadgeKind;
  text: string;
}

export const REASON_COPY = {
  gone: "This item was already removed, so the change wasn't applied.",
  conflict: "This was already updated elsewhere. Your change wasn't applied.",
  invalid: "The server couldn't accept this change. Edit the item and try again.",
  replayExpired: 'This change may already be saved. Check the item, then retry or discard it.',
  upgradeNative:
    "Your pantry is at the 25-item free limit, so this item wasn't added. Unlock Kumaun Full or free up a spot, then retry.",
  upgradeWeb:
    "Your pantry is at the 25-item free limit, so this item wasn't added. Free up a spot, or unlock in the Kumaun iOS app, then retry.",
  upgradeFinishNative:
    "Your pantry is at the 25-item free limit, so this trip wasn't finished. Unlock Kumaun Full or free up pantry spots, then retry.",
  upgradeFinishWeb:
    "Your pantry is at the 25-item free limit, so this trip wasn't finished. Free up pantry spots, or unlock in the Kumaun iOS app, then retry.",
  maxAttempts: (n: number) => `Couldn't reach the server after ${n} tries. Check your connection and retry.`,
} as const;

const q = (label: string): string => `"${label}"`;
const fmt = (n: number): string => String(Math.round(n * 100) / 100);

function describeShoppingUpdate(op: OutboxOp): string {
  const patch = (op.payload as { patch: Record<string, unknown> }).patch;
  const keys = Object.keys(patch);
  if (keys.length === 1 && keys[0] === 'isChecked') {
    return patch.isChecked === true ? `Checked off ${q(op.label)}` : `Unchecked ${q(op.label)}`;
  }
  return `Changed ${q(op.label)} on shopping list`;
}

function describeAdjust(op: OutboxOp): string {
  const { delta } = op.payload as { delta: number };
  return delta < 0
    ? `Used ${fmt(Math.abs(delta))} of ${q(op.label)} in pantry`
    : `Added ${fmt(delta)} to ${q(op.label)} in pantry`;
}

export function describeOp(op: OutboxOp): string {
  switch (op.kind) {
    case 'shopping.item.create':
      return `Added ${q(op.label)} to shopping list`;
    case 'shopping.item.update':
      return describeShoppingUpdate(op);
    case 'shopping.item.delete':
      return `Removed ${q(op.label)} from shopping list`;
    case 'pantry.create':
      return `Added ${q(op.label)} to pantry`;
    case 'pantry.adjust':
      return describeAdjust(op);
    case 'pantry.update':
      return 'expiryDate' in (op.payload as { patch: object }).patch
        ? `Changed expiry of ${q(op.label)}`
        : `Changed ${q(op.label)} in pantry`;
    case 'pantry.delete':
      return `Removed ${q(op.label)} from pantry`;
    case 'cook.apply':
      return `Marked ${q(op.label)} as cooked`;
    case 'shopping.finish':
      return 'Finished shopping trip';
  }
}

export type Platform = 'native' | 'web';

export function isUpgradeConflict(op: OutboxOp): boolean {
  return op.state === 'failed' && op.lastError?.reason === 'conflict' && op.lastError.code === 'UPGRADE_REQUIRED';
}

function upgradeCopy(op: OutboxOp, platform: Platform): string {
  const finish = op.kind === 'shopping.finish';
  if (platform === 'web') return finish ? REASON_COPY.upgradeFinishWeb : REASON_COPY.upgradeWeb;
  return finish ? REASON_COPY.upgradeFinishNative : REASON_COPY.upgradeNative;
}

export function reasonCopy(op: OutboxOp, platform: Platform = 'native'): string | null {
  if (op.state !== 'failed' || !op.lastError) return null;
  if (isUpgradeConflict(op)) return upgradeCopy(op, platform);
  switch (op.lastError.reason) {
    case 'gone':
      return REASON_COPY.gone;
    case 'conflict':
      return op.lastError.code === 'REPLAY_EXPIRED' ? REASON_COPY.replayExpired : REASON_COPY.conflict;
    case 'invalid':
      return REASON_COPY.invalid;
    case 'max-attempts':
      return REASON_COPY.maxAttempts(op.attempts || MAX_TRANSIENT_ATTEMPTS);
    default:
      return null;
  }
}

export function canRetry(op: OutboxOp): boolean {
  if (op.state !== 'failed') return false;
  const reason = op.lastError?.reason;
  return reason !== 'gone' && reason !== 'invalid';
}

export function rowBadge(op: OutboxOp, now: number): RowBadge {
  if (op.state === 'failed') {
    if (isUpgradeConflict(op)) return { kind: 'conflict', text: 'Needs upgrade' };
    return op.lastError?.reason === 'conflict'
      ? { kind: 'conflict', text: 'Conflict' }
      : { kind: 'failed', text: 'Failed' };
  }
  if (op.state === 'in_flight') return { kind: 'syncing', text: 'Syncing' };
  if (op.state === 'queued' && op.nextAttemptAt > now) {
    return { kind: 'retrying', text: `Retrying in ${Math.ceil((op.nextAttemptAt - now) / 1000)}s` };
  }
  return { kind: 'waiting', text: 'Waiting' };
}

export function savedAgo(createdAt: number, now: number): string {
  const phrase = relativeTimeAgo(createdAt, now);
  if (phrase === 'just now') return 'Saved just now';
  return `Saved ${phrase.replace(/(\d+) minutes? ago$/, '$1 min ago')}`;
}
