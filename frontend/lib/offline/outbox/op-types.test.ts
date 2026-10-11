import { describe, expect, it } from 'vitest';
import { NewOpSchema, barrierFor, entityOf, OP_KINDS, type NewOp } from './op-types';

const ID = '3f2b8a52-8c1e-4c6e-9a53-1f0e5d3b7a10';
const ID2 = '4f2b8a52-8c1e-4c6e-9a53-1f0e5d3b7a11';

describe('NewOpSchema', () => {
  it('accepts a valid adjust op', () => {
    const r = NewOpSchema.safeParse({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID, delta: 1.25 } });
    expect(r.success).toBe(true);
  });
  it('rejects pantry.update with a quantity key', () => {
    const r = NewOpSchema.safeParse({ kind: 'pantry.update', label: 'Rice', payload: { id: ID, patch: { quantity: 3 } } });
    expect(r.success).toBe(false);
  });
  it('rejects empty pantry.update patch', () => {
    expect(NewOpSchema.safeParse({ kind: 'pantry.update', label: 'x', payload: { id: ID, patch: {} } }).success).toBe(false);
  });
  it('rejects adjust delta 0 and 0.001', () => {
    for (const delta of [0, 0.001]) {
      expect(NewOpSchema.safeParse({ kind: 'pantry.adjust', label: 'x', payload: { id: ID, delta } }).success).toBe(false);
    }
  });
  it('rejects non-uuid ids and empty labels', () => {
    expect(NewOpSchema.safeParse({ kind: 'shopping.item.delete', label: 'x', payload: { id: 'nope' } }).success).toBe(false);
    expect(NewOpSchema.safeParse({ kind: 'shopping.item.delete', label: '', payload: { id: ID } }).success).toBe(false);
  });
  it('rejects empty shopping update patch and bad finish date', () => {
    expect(NewOpSchema.safeParse({ kind: 'shopping.item.update', label: 'x', payload: { id: ID, patch: {} } }).success).toBe(false);
    expect(
      NewOpSchema.safeParse({ kind: 'shopping.finish', label: 'x', payload: { input: { occurredAt: 'bad', receiptDate: '2026-01-01' } } }).success
    ).toBe(false);
  });
});

describe('entityOf / barrierFor', () => {
  it('maps entities', () => {
    const cook: NewOp = { kind: 'cook.apply', label: 'Soup', payload: { target: { mealPlanItemId: ID2 }, servings: 2, occurredAt: '2026-01-01T00:00:00.000Z' } };
    expect(entityOf(cook)).toEqual({ entityType: 'cook', entityId: ID2 });
    const fin: NewOp = { kind: 'shopping.finish', label: 'Trip', payload: { input: { occurredAt: '2026-01-01T00:00:00.000Z', receiptDate: '2026-01-01' } } };
    expect(entityOf(fin)).toEqual({ entityType: 'shopping-list', entityId: 'active' });
    expect(entityOf({ kind: 'pantry.delete', label: 'x', payload: { id: ID } })).toEqual({ entityType: 'pantry-item', entityId: ID });
  });
  it('barriers', () => {
    expect(barrierFor('shopping.finish')).toEqual(['shopping-item']);
    expect(barrierFor('cook.apply')).toEqual(['pantry-item']);
    expect(barrierFor('pantry.adjust')).toBeNull();
    expect(OP_KINDS).toHaveLength(9);
  });
});
