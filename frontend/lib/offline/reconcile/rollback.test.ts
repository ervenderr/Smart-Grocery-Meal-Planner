import { describe, expect, it } from 'vitest';
import { rollbackOp } from './rollback';
import { makeOp, ID_A, ID_B } from '../outbox/fixtures.test-helper';
import { deepFreeze, ID_C, mealPlans, pantryItem, shoppingList } from './fixtures.test-helper';
import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingList } from '@/types/shopping.types';
import type { MealPlan } from '@/types/mealplan.types';

describe('rollbackOp', () => {
  it('shopping update restores previous fields only', () => {
    const op = makeOp({ kind: 'shopping.item.update', label: 'Eggs', payload: { id: ID_B, patch: { quantity: 2, notes: 'x' } }, inverse: { previous: { quantity: 12 } } });
    const { writes, needsRefetch } = rollbackOp(op);
    expect(needsRefetch).toBe(false);
    const list = shoppingList();
    const changed = { ...list, items: [{ ...list.items[0], quantity: 2, notes: 'x' }] };
    const out = writes[0].update(deepFreeze(changed)) as ShoppingList;
    expect(out.items[0]).toMatchObject({ quantity: 12, notes: 'x' });
  });
  it('shopping delete restores the item; create removes it', () => {
    const item = shoppingList().items[0];
    const del = rollbackOp(makeOp({ kind: 'shopping.item.delete', label: 'Eggs', payload: { id: ID_B }, inverse: { item } }));
    expect((del.writes[0].update({ ...shoppingList(), items: [] }) as ShoppingList).items).toEqual([item]);
    const cre = rollbackOp(makeOp({ kind: 'shopping.item.create', label: 'Eggs', payload: { item: { id: ID_B, itemName: 'Eggs' } }, inverse: {} }));
    expect((cre.writes[0].update(shoppingList()) as ShoppingList).items).toHaveLength(0);
    expect(cre.writes[0].update(undefined)).toBeUndefined();
  });
  it('pantry create removes the item', () => {
    const op = makeOp({ kind: 'pantry.create', label: 'Rice', payload: { item: { id: ID_A, ingredientName: 'Rice', category: 'grains', quantity: 1, unit: 'kg' } }, inverse: {} });
    expect(rollbackOp(op).writes[0].update([pantryItem(1)])).toEqual([]);
  });
  it('pantry adjust subtracts delta, clamped at 0', () => {
    const op = makeOp({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 }, inverse: {} });
    const { writes } = rollbackOp(op);
    expect((writes[0].update(deepFreeze([pantryItem(5)])) as PantryItem[])[0].quantity).toBe(3);
    const cook = writes[1].update({ items: [pantryItem(1)], capped: false }) as { items: PantryItem[] };
    expect(cook.items[0].quantity).toBe(0);
  });
  it('pantry update restores previous; pantry delete restores item once', () => {
    const upd = rollbackOp(makeOp({ kind: 'pantry.update', label: 'Rice', payload: { id: ID_A, patch: { notes: 'n' } }, inverse: { previous: { notes: null } } }));
    expect((upd.writes[0].update([{ ...pantryItem(1), notes: 'n' }]) as PantryItem[])[0].notes).toBeNull();
    const del = rollbackOp(makeOp({ kind: 'pantry.delete', label: 'Rice', payload: { id: ID_A }, inverse: { item: { ...pantryItem(1), quantity: '4' } } }));
    expect((del.writes[0].update([]) as PantryItem[])[0].quantity).toBe(4);
    expect(del.writes[0].update([pantryItem(1)])).toHaveLength(1);
  });
  it('cook.apply restores previousCookedAt', () => {
    const op = makeOp({ kind: 'cook.apply', label: 'c', payload: { target: { mealPlanItemId: ID_C }, servings: 1, occurredAt: '2026-10-11T10:00:00.000Z' }, inverse: { previousCookedAt: null } });
    const plans = mealPlans().map((p) => ({ ...p, meals: p.meals.map((m) => ({ ...m, cookedAt: 'z' })) }));
    const out = rollbackOp(op).writes[0].update(deepFreeze(plans)) as MealPlan[];
    expect(out[0].meals[0].cookedAt).toBeNull();
  });
  it('cook.apply by recipe and shopping.finish produce no writes', () => {
    const recipe = makeOp({ kind: 'cook.apply', label: 'c', payload: { target: { recipeId: ID_C }, servings: 1, occurredAt: '2026-10-11T10:00:00.000Z' }, inverse: { previousCookedAt: null } });
    expect(rollbackOp(recipe)).toEqual({ writes: [], needsRefetch: false });
    const fin = makeOp({ kind: 'shopping.finish', label: 'f', payload: { input: { occurredAt: '2026-10-11T10:00:00.000Z', receiptDate: '2026-10-11' } }, inverse: {} });
    expect(rollbackOp(fin)).toEqual({ writes: [], needsRefetch: false });
  });
  it('invalid inverse requests a refetch with no writes', () => {
    const op = makeOp({ kind: 'shopping.item.delete', label: 'Eggs', payload: { id: ID_B }, inverse: { bogus: true } });
    expect(rollbackOp(op)).toEqual({ writes: [], needsRefetch: true });
  });
});
