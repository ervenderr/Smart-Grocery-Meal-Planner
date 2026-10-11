import { describe, expect, it } from 'vitest';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import { buildSheetModel } from './sheet-model';

// WR-03: a finish/cook held back by a parked earlier change says what it is waiting on.
const check = (over = {}) =>
  makeOp({ kind: 'shopping.item.update', label: 'Milk', payload: { id: ID_A, patch: { isChecked: true } } }, over);
const finish = (over = {}) =>
  makeOp(
    { kind: 'shopping.finish', label: 'Trip', payload: { input: { occurredAt: '2026-01-01T00:00:00.000Z', receiptDate: '2026-01-01' } } },
    over,
  );

describe('sheet model barrier hint', () => {
  it('labels a finish waiting on a failed check-off', () => {
    const failed = check({ state: 'failed', lastError: { reason: 'conflict' } });
    const fin = finish();
    const model = buildSheetModel({ ops: [failed, fin], connectivity: 'online', draining: false, bootstrapping: false, now: 0 });
    expect(model.waiting.find((r) => r.seq === fin.seq)?.badge).toEqual({ kind: 'waiting', text: 'Waiting on 1 failed change' });
  });

  it('keeps the plain badge when nothing earlier is parked', () => {
    const fin = finish();
    const model = buildSheetModel({ ops: [check(), fin], connectivity: 'online', draining: false, bootstrapping: false, now: 0 });
    expect(model.waiting.find((r) => r.seq === fin.seq)?.badge).toEqual({ kind: 'waiting', text: 'Waiting' });
  });
});
