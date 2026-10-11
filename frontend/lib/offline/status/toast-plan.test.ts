import { describe, expect, it } from 'vitest';
import { ID_A, makeOp } from '../outbox/fixtures.test-helper';
import type { DrainEvent } from '../outbox/drain';
import type { NewOp } from '../outbox/op-types';
import { planDrainToasts } from './toast-plan';
import { usePendingSheet, openPendingSheet } from './sheet-store';

const item = { id: ID_A, itemName: 'Milk' };
const shop = makeOp({ kind: 'shopping.item.create', payload: { item }, label: 'Milk' } as NewOp);
const applied = (op = shop, result: unknown = null): DrainEvent => ({ type: 'applied', op, result });
const parked = (op = shop): DrainEvent => ({ type: 'parked', op, error: { reason: 'gone' } });

describe('planDrainToasts', () => {
  it('no events -> no toasts', () => expect(planDrainToasts([])).toEqual([]));
  it('aggregates many applied', () => {
    expect(planDrainToasts([applied(), applied(), applied()])).toEqual([{ kind: 'success', message: '3 changes synced' }]);
  });
  it('singular', () => {
    expect(planDrainToasts([applied()])).toEqual([{ kind: 'success', message: '1 change synced' }]);
  });
  it('late cook', () => {
    const op = makeOp({ kind: 'cook.apply', payload: { target: { mealPlanItemId: ID_A }, servings: 1 }, label: 'Pasta' } as NewOp);
    expect(planDrainToasts([applied(op)])[0].message).toBe('Synced: marked "Pasta" as cooked.');
  });
  it('late finish', () => {
    const op = makeOp({ kind: 'shopping.finish', payload: { input: {} }, label: 'Trip' } as unknown as NewOp);
    expect(planDrainToasts([applied(op)])[0].message).toBe('Synced: your shopping trip was recorded.');
  });
  it('cook among many is aggregated', () => {
    const op = makeOp({ kind: 'cook.apply', payload: { target: { mealPlanItemId: ID_A }, servings: 1 }, label: 'Pasta' } as NewOp);
    expect(planDrainToasts([applied(op), applied()])[0].message).toBe('2 changes synced');
  });
  it('parked -> attention', () => {
    expect(planDrainToasts([parked(), parked()])).toEqual([{ kind: 'attention', message: '2 changes need attention' }]);
    expect(planDrainToasts([parked()])[0].message).toBe('1 change needs attention');
  });
  it('success and attention together', () => {
    expect(planDrainToasts([applied(), parked()]).map((t) => t.kind)).toEqual(['success', 'attention']);
  });
  it('used up info on zero quantity after negative delta', () => {
    const op = makeOp({ kind: 'pantry.adjust', payload: { id: ID_A, delta: -2 }, label: 'Eggs' } as NewOp);
    const t = planDrainToasts([applied(op, { id: ID_A, quantity: '0' })]);
    expect(t.map((x) => x.message)).toEqual(['1 change synced', 'Eggs was used up. Quantity set to 0.']);
  });
  it('no used-up for positive delta, nonzero, or unknown result', () => {
    const neg = makeOp({ kind: 'pantry.adjust', payload: { id: ID_A, delta: -1 }, label: 'Eggs' } as NewOp);
    const pos = makeOp({ kind: 'pantry.adjust', payload: { id: ID_A, delta: 1 }, label: 'Eggs' } as NewOp);
    expect(planDrainToasts([applied(neg, { id: ID_A, quantity: 3 })]).length).toBe(1);
    expect(planDrainToasts([applied(pos, { id: ID_A, quantity: 0 })]).length).toBe(1);
    expect(planDrainToasts([applied(neg, null)]).length).toBe(1);
    expect(planDrainToasts([applied(neg, { id: ID_A, quantity: 'x' })]).length).toBe(1);
  });
});

describe('sheet store', () => {
  it('opens and closes', () => {
    openPendingSheet();
    expect(usePendingSheet.getState().open).toBe(true);
    usePendingSheet.getState().setOpen(false);
    expect(usePendingSheet.getState().open).toBe(false);
  });
});
