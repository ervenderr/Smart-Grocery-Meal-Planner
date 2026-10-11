import { describe, expect, it } from 'vitest';
import { applyResult } from './apply-result';
import { makeOp, ID_A, ID_B } from '../outbox/fixtures.test-helper';
import { COOK_PANTRY_KEY } from '@/lib/hooks/use-cook-from-pantry';
import { PANTRY_ALL_KEY, SHOPPING_ACTIVE_KEY, keyHash } from '../cache/cache-keys';
import { deepFreeze, pantryItem, shoppingList } from './fixtures.test-helper';
import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingList } from '@/types/shopping.types';

const adjust = makeOp({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } });

describe('applyResult', () => {
  it('patches pantry adjust with the normalized server quantity in both keys', () => {
    const writes = applyResult(adjust, { ...pantryItem(1), quantity: '7.50' });
    expect(writes.map((w) => keyHash(w.key))).toEqual([keyHash(PANTRY_ALL_KEY), keyHash(COOK_PANTRY_KEY)]);
    const out = writes[0].update(deepFreeze([pantryItem(9)])) as PantryItem[];
    expect(out[0].quantity).toBe(7.5);
  });
  it('accepts wrapped results and leaves other pantry rows alone', () => {
    const writes = applyResult(adjust, { data: { ...pantryItem(1), quantity: '3' } });
    const other = { ...pantryItem(1), id: 'other' };
    const out = writes[1].update([other, pantryItem(9)]) as PantryItem[];
    expect(out[0]).toBe(other);
    expect(out[1].quantity).toBe(3);
  });
  it('replaces the optimistic shopping item by id', () => {
    const op = makeOp({ kind: 'shopping.item.create', label: 'Eggs', payload: { item: { id: ID_B, itemName: 'Eggs' } } });
    const writes = applyResult(op, { id: ID_B, itemName: 'Eggs', quantity: 6 });
    expect(keyHash(writes[0].key)).toBe(keyHash(SHOPPING_ACTIVE_KEY));
    const out = writes[0].update(shoppingList()) as ShoppingList;
    expect(out.items[0]).toMatchObject({ id: ID_B, quantity: 6 });
  });
  it('removes on delete results and tolerates undefined cache', () => {
    const del = makeOp({ kind: 'shopping.item.delete', label: 'Eggs', payload: { id: ID_B } });
    const w = applyResult(del, null)[0];
    expect((w.update(shoppingList()) as ShoppingList).items).toHaveLength(0);
    expect(w.update(undefined)).toBeUndefined();
    const pdel = applyResult(makeOp({ kind: 'pantry.delete', label: 'Rice', payload: { id: ID_A } }), null);
    expect(pdel[0].update([pantryItem(1)])).toEqual([]);
    expect(pdel[0].update(undefined)).toBeUndefined();
  });
  it('returns no writes for unknown, mismatched or invalid results', () => {
    expect(applyResult(adjust, null)).toEqual([]);
    expect(applyResult(adjust, { id: 'wrong' })).toEqual([]);
    expect(applyResult(adjust, { ...pantryItem(1), quantity: 'abc' })).toEqual([]);
    const fin = makeOp({ kind: 'shopping.finish', label: 'f', payload: { input: { occurredAt: '2026-10-11T10:00:00.000Z', receiptDate: '2026-10-11' } } });
    expect(applyResult(fin, {})).toEqual([]);
  });
});
