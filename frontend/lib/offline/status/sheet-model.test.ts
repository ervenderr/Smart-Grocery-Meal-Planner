import { describe, expect, it } from 'vitest';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import type { NewOp, OutboxOp } from '../outbox/op-types';
import { buildSheetModel } from './sheet-model';

const mk = (label: string, over: Partial<OutboxOp> = {}): OutboxOp =>
  makeOp({ kind: 'pantry.delete', payload: { id: ID_A }, label } as NewOp, over);
const base = { connectivity: 'online' as const, draining: false, bootstrapping: false, now: 1000 };

describe('buildSheetModel', () => {
  it('offline with waiting ops, oldest first', () => {
    const b = mk('B', { seq: 20 });
    const a = mk('A', { seq: 10 });
    const m = buildSheetModel({ ...base, connectivity: 'offline', ops: [b, a, mk('C', { seq: 30 })] });
    expect(m.summary).toBe("Offline. 3 changes will sync when you're back online.");
    expect(m.attention).toHaveLength(0);
    expect(m.waiting.map((r) => r.seq)).toEqual([10, 20, 30]);
    expect(m.showRetryAll).toBe(false);
    expect(m.empty).toBeNull();
  });
  it('failed online shows retry all and discard all', () => {
    const m = buildSheetModel({
      ...base,
      ops: [mk('A', { state: 'failed', attempts: 8, lastError: { reason: 'max-attempts' } }), mk('B')],
    });
    expect(m.showRetryAll).toBe(true);
    expect(m.showDiscardAll).toBe(true);
    expect(m.failedCount).toBe(1);
    expect(m.attention[0]).toMatchObject({ canRetry: true, canDiscard: true });
    expect(m.waiting[0]).toMatchObject({ canDiscard: false, canRetry: false });
  });
  it('only non-retryable failures hides retry all', () => {
    const m = buildSheetModel({ ...base, ops: [mk('A', { state: 'failed', lastError: { reason: 'gone' } })] });
    expect(m.showRetryAll).toBe(false);
    expect(m.showDiscardAll).toBe(true);
  });
  it('backoff wait shows retry all', () => {
    expect(buildSheetModel({ ...base, ops: [mk('A', { nextAttemptAt: 9000 })] }).showRetryAll).toBe(true);
  });
  it('empty states', () => {
    expect(buildSheetModel({ ...base, ops: [] }).empty).toEqual({
      heading: 'Nothing waiting',
      body: 'Everything you changed is saved and synced.',
    });
    expect(buildSheetModel({ ...base, connectivity: 'offline', ops: [] }).empty).toEqual({
      heading: "You're offline",
      body: "You can keep using Kitcha. New changes will show up here and sync when you're back online.",
    });
  });
  it('summaries', () => {
    expect(buildSheetModel({ ...base, ops: [], bootstrapping: true }).summary).toBe('Downloading your data...');
    expect(buildSheetModel({ ...base, ops: [mk('A'), mk('B')], draining: true }).summary).toBe('Syncing 2 changes...');
    expect(buildSheetModel({ ...base, ops: [] }).summary).toBe('All changes are synced.');
    expect(buildSheetModel({ ...base, ops: [mk('A')] }).summary).toBe('1 change waiting to sync.');
    expect(buildSheetModel({ ...base, connectivity: 'offline', ops: [] }).summary).toContain('Offline');
  });
  it('uses Date.now when now omitted', () => {
    expect(buildSheetModel({ connectivity: 'online', draining: false, bootstrapping: false, ops: [mk('A')] }).waiting).toHaveLength(1);
  });
});
