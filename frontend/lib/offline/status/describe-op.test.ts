import { describe, expect, it } from 'vitest';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import type { NewOp, OutboxOp } from '../outbox/op-types';
import { canRetry, describeOp, isUpgradeConflict, reasonCopy, rowBadge, savedAgo } from './describe-op';

const mk = (op: unknown, over: Partial<OutboxOp> = {}): OutboxOp => makeOp(op as NewOp, over);
const upd = (patch: object) => mk({ kind: 'shopping.item.update', payload: { id: ID_A, patch }, label: 'Milk' });
const pupd = (patch: object) => mk({ kind: 'pantry.update', payload: { id: ID_A, patch }, label: 'Eggs' });
const adj = (delta: number) => mk({ kind: 'pantry.adjust', payload: { id: ID_A, delta }, label: 'Eggs' });
const item = { id: ID_A, itemName: 'Milk' };

describe('describeOp', () => {
  it('describes each kind', () => {
    expect(describeOp(mk({ kind: 'shopping.item.create', payload: { item }, label: 'Milk' }))).toBe('Added "Milk" to shopping list');
    expect(describeOp(mk({ kind: 'shopping.item.delete', payload: { id: ID_A }, label: 'Milk' }))).toBe('Removed "Milk" from shopping list');
    expect(describeOp(mk({ kind: 'pantry.create', payload: { item }, label: 'Rice' }))).toBe('Added "Rice" to pantry');
    expect(describeOp(mk({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'Rice' }))).toBe('Removed "Rice" from pantry');
    expect(describeOp(mk({ kind: 'cook.apply', payload: { target: { mealPlanItemId: ID_A } }, label: 'Pasta night' }))).toBe('Marked "Pasta night" as cooked');
    expect(describeOp(mk({ kind: 'shopping.finish', payload: {}, label: 'Trip' }))).toBe('Finished shopping trip');
  });
  it('shopping update variants', () => {
    expect(describeOp(upd({ isChecked: true }))).toBe('Checked off "Milk"');
    expect(describeOp(upd({ isChecked: false }))).toBe('Unchecked "Milk"');
    expect(describeOp(upd({ isChecked: true, notes: 'x' }))).toBe('Changed "Milk" on shopping list');
  });
  it('adjust sign variants', () => {
    expect(describeOp(adj(-2))).toBe('Used 2 of "Eggs" in pantry');
    expect(describeOp(adj(1.5))).toBe('Added 1.5 to "Eggs" in pantry');
  });
  it('pantry update variants', () => {
    expect(describeOp(pupd({ expiryDate: '2026-01-01' }))).toBe('Changed expiry of "Eggs"');
    expect(describeOp(pupd({ notes: 'x' }))).toBe('Changed "Eggs" in pantry');
  });
});

describe('reasonCopy and canRetry', () => {
  const failed = (reason: string, attempts = 0) =>
    mk({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'x' }, { state: 'failed', attempts, lastError: { reason } as OutboxOp['lastError'] });
  it('maps reasons', () => {
    expect(reasonCopy(failed('gone'))).toBe("This item was already removed, so the change wasn't applied.");
    expect(reasonCopy(failed('conflict'))).toBe("This was already updated elsewhere. Your change wasn't applied.");
    expect(reasonCopy(failed('invalid'))).toBe("The server couldn't accept this change. Edit the item and try again.");
    expect(reasonCopy(failed('max-attempts', 8))).toBe("Couldn't reach the server after 8 tries. Check your connection and retry.");
    expect(reasonCopy(failed('max-attempts', 0))).toContain('8 tries');
  });
  it('hides raw reasons for non-failed or transient', () => {
    expect(reasonCopy(adj(-1))).toBeNull();
    expect(reasonCopy(failed('transient'))).toBeNull();
    expect(reasonCopy(mk({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'x' }, { state: 'failed' }))).toBeNull();
  });
  it('canRetry', () => {
    expect(canRetry(failed('gone'))).toBe(false);
    expect(canRetry(failed('invalid'))).toBe(false);
    expect(canRetry(failed('conflict'))).toBe(true);
    expect(canRetry(failed('max-attempts'))).toBe(true);
    expect(canRetry(adj(-1))).toBe(false);
  });
});

describe('rowBadge and savedAgo', () => {
  it('badges', () => {
    expect(rowBadge(adj(-1), 1000)).toEqual({ kind: 'waiting', text: 'Waiting' });
    expect(rowBadge(mk({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'x' }, { state: 'in_flight' }), 0).text).toBe('Syncing');
    const retrying = mk({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'x' }, { nextAttemptAt: 6000 });
    expect(rowBadge(retrying, 1000)).toEqual({ kind: 'retrying', text: 'Retrying in 5s' });
    const conflict = mk({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'x' }, { state: 'failed', lastError: { reason: 'conflict' } });
    expect(rowBadge(conflict, 0)).toEqual({ kind: 'conflict', text: 'Conflict' });
    const gone = mk({ kind: 'pantry.delete', payload: { id: ID_A }, label: 'x' }, { state: 'failed', lastError: { reason: 'gone' } });
    expect(rowBadge(gone, 0)).toEqual({ kind: 'failed', text: 'Failed' });
  });
  it('savedAgo', () => {
    const now = 10_000_000;
    expect(savedAgo(now - 5000, now)).toBe('Saved just now');
    expect(savedAgo(now - 5 * 60_000, now)).toBe('Saved 5 min ago');
    expect(savedAgo(now - 60_000, now)).toBe('Saved 1 min ago');
    expect(savedAgo(now - 2 * 3_600_000, now)).toBe('Saved 2 hours ago');
  });
});

describe('UPGRADE_REQUIRED conflict', () => {
  const upErr = { reason: 'conflict', status: 403, code: 'UPGRADE_REQUIRED' } as OutboxOp['lastError'];
  const create = mk({ kind: 'pantry.create', payload: { item }, label: 'Rice' }, { state: 'failed', lastError: upErr });
  const finish = mk({ kind: 'shopping.finish', payload: {}, label: 'Trip' }, { state: 'failed', lastError: upErr });
  it('badges and is retryable', () => {
    expect(isUpgradeConflict(create)).toBe(true);
    expect(rowBadge(create, 0)).toEqual({ kind: 'conflict', text: 'Needs upgrade' });
    expect(rowBadge(finish, 0)).toEqual({ kind: 'conflict', text: 'Needs upgrade' });
    expect(canRetry(create)).toBe(true);
  });
  it('pantry create copy native and web', () => {
    expect(reasonCopy(create)).toBe(
      "Your pantry is at the 25-item free limit, so this item wasn't added. Unlock Kumaun Full or free up a spot, then retry.",
    );
    expect(reasonCopy(create, 'web')).toBe(
      "Your pantry is at the 25-item free limit, so this item wasn't added. Free up a spot, or unlock in the Kumaun iOS app, then retry.",
    );
  });
  it('trip finish copy native and web', () => {
    expect(reasonCopy(finish)).toBe(
      "Your pantry is at the 25-item free limit, so this trip wasn't finished. Unlock Kumaun Full or free up pantry spots, then retry.",
    );
    expect(reasonCopy(finish, 'web')).toBe(
      "Your pantry is at the 25-item free limit, so this trip wasn't finished. Free up pantry spots, or unlock in the Kumaun iOS app, then retry.",
    );
  });
  it('other conflicts are unchanged', () => {
    const other = mk({ kind: 'pantry.create', payload: { item }, label: 'Rice' }, {
      state: 'failed',
      lastError: { reason: 'conflict', code: 'REPLAY_EXPIRED' } as OutboxOp['lastError'],
    });
    expect(isUpgradeConflict(other)).toBe(false);
    expect(rowBadge(other, 0)).toEqual({ kind: 'conflict', text: 'Conflict' });
    expect(reasonCopy(other)).toBe('This change may already be saved. Check the item, then retry or discard it.');
  });
});
