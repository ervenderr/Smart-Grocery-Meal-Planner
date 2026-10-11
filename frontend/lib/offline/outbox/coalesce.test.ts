import { describe, expect, it } from 'vitest';
import { planEnqueue } from './coalesce';
import type { NewOp } from './op-types';
import { ID_A, makeOp } from './fixtures.test-helper';

const upd = (patch: Record<string, unknown>, previous: Record<string, unknown> = {}): NewOp =>
  ({ kind: 'shopping.item.update', label: 'Milk', payload: { id: ID_A, patch }, inverse: { previous } }) as NewOp;
const adj = (delta: number): NewOp => ({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta } });
const create: NewOp = { kind: 'shopping.item.create', label: 'Milk', payload: { item: { id: ID_A, itemName: 'Milk', quantity: 1 } } };
const del: NewOp = { kind: 'shopping.item.delete', label: 'Milk', payload: { id: ID_A } };

describe('planEnqueue', () => {
  it('inserts when nothing is pending', () => {
    expect(planEnqueue([], upd({ isChecked: true }))).toEqual({ type: 'insert' });
  });
  it('merges update into un-attempted update LWW', () => {
    const p = makeOp(upd({ quantity: 2, notes: 'a' }, { quantity: 1, notes: null }));
    const plan = planEnqueue([p], upd({ quantity: 3, isChecked: true }, { quantity: 2, isChecked: false }));
    expect(plan).toEqual({
      type: 'merge',
      seq: p.seq,
      payload: { id: ID_A, patch: { quantity: 3, notes: 'a', isChecked: true } },
      inverse: { previous: { quantity: 1, notes: null, isChecked: false } },
    });
  });
  it('does not mutate inputs', () => {
    const p = makeOp(upd({ quantity: 2 }, { quantity: 1 }));
    const snap = JSON.stringify(p);
    planEnqueue([p], upd({ quantity: 3 }, { quantity: 2 }));
    expect(JSON.stringify(p)).toBe(snap);
  });
  it('inserts after an attempted update', () => {
    const p = makeOp(upd({ quantity: 2 }), { attempts: 1 });
    expect(planEnqueue([p], upd({ quantity: 3 }))).toEqual({ type: 'insert' });
  });
  it('treats queued op with lastError as attempted', () => {
    const p = makeOp(upd({ quantity: 2 }), { lastError: { reason: 'transient' } });
    expect(planEnqueue([p], upd({ quantity: 3 }))).toEqual({ type: 'insert' });
  });
  it('inserts when in_flight', () => {
    const p = makeOp(upd({ quantity: 2 }), { state: 'in_flight' });
    expect(planEnqueue([p], upd({ quantity: 3 }))).toEqual({ type: 'insert' });
  });
  it('sums adjusts', () => {
    const p = makeOp(adj(2));
    const plan = planEnqueue([p], adj(3));
    expect(plan).toMatchObject({ type: 'merge', seq: p.seq, payload: { id: ID_A, delta: 5 } });
  });
  it('sums 0.1 + 0.2 to exactly 0.3', () => {
    const plan = planEnqueue([makeOp(adj(0.1))], adj(0.2));
    expect(plan).toMatchObject({ type: 'merge', payload: { delta: 0.3 } });
    if (plan.type === 'merge') expect((plan.payload as { delta: number }).delta).toBe(0.3);
  });
  it('drops both when adjusts cancel', () => {
    const p = makeOp(adj(2));
    expect(planEnqueue([p], adj(-2))).toEqual({ type: 'drop', seqs: [p.seq], insert: false });
  });
  it('merges update into un-attempted create', () => {
    const c = makeOp(create);
    const plan = planEnqueue([c], upd({ quantity: 4, notes: 'x' }));
    expect(plan).toMatchObject({
      type: 'merge',
      seq: c.seq,
      payload: { item: { id: ID_A, itemName: 'Milk', quantity: 4, notes: 'x' } },
    });
  });
  it('delete after un-attempted create drops everything and inserts nothing', () => {
    const c = makeOp(create);
    const u = makeOp(upd({ quantity: 2 }));
    expect(planEnqueue([c, u], del)).toEqual({ type: 'drop', seqs: [c.seq, u.seq], insert: false });
  });
  it('delete after attempted create drops un-attempted updates and inserts delete', () => {
    const c = makeOp(create, { attempts: 1, state: 'queued' });
    const u = makeOp(upd({ quantity: 2 }));
    expect(planEnqueue([c, u], del)).toEqual({ type: 'drop', seqs: [u.seq], insert: true });
  });
  it('delete with nothing droppable is a plain insert', () => {
    expect(planEnqueue([], del)).toEqual({ type: 'insert' });
  });
  it('never merges non-mergeable kinds', () => {
    const f: NewOp = { kind: 'shopping.finish', label: 'Trip', payload: { input: { occurredAt: '2026-01-01T00:00:00.000Z', receiptDate: '2026-01-01' } } };
    expect(planEnqueue([makeOp(f)], f)).toEqual({ type: 'insert' });
  });
});
