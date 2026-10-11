import { describe, expect, it } from 'vitest';
import { foldMealPlans, foldPantryList, foldShoppingList } from './fold';
import type { NewOp } from './op-types';
import { ID_A, ID_B, makeOp } from './fixtures.test-helper';
import type { ShoppingList } from '@/types/shopping.types';
import type { PantryItem } from '@/types/pantry.types';
import type { MealPlan } from '@/types/mealplan.types';

const list: ShoppingList = {
  id: 'L', name: 'List', mealPlanId: null, isCompleted: false, createdAt: 'x', updatedAt: 'x',
  items: [{ id: ID_B, shoppingListId: 'L', itemName: 'Eggs', quantity: 12, unit: 'pcs', category: 'dairy', costEstimateCents: null, actualCostCents: null, isChecked: false, notes: null, createdAt: 'x', updatedAt: 'x' }],
};
const pantry = (q: number): PantryItem => ({ id: ID_A, userId: 'u1', ingredientName: 'Rice', category: 'grains', quantity: q, unit: 'kg', createdAt: 'x', updatedAt: 'x' });

describe('foldShoppingList', () => {
  it('applies create, update, check, delete in seq order', () => {
    const ops = [
      makeOp({ kind: 'shopping.item.create', label: 'Milk', payload: { item: { id: ID_A, itemName: 'Milk', quantity: 2 } } }),
      makeOp({ kind: 'shopping.item.update', label: 'Milk', payload: { id: ID_A, patch: { quantity: 3 } } }),
      makeOp({ kind: 'shopping.item.update', label: 'Eggs', payload: { id: ID_B, patch: { isChecked: true } } }),
    ];
    const out = foldShoppingList(list, ops);
    expect(out.items.find((i) => i.id === ID_A)).toMatchObject({ itemName: 'Milk', quantity: 3, shoppingListId: 'L' });
    expect(out.items.find((i) => i.id === ID_B)?.isChecked).toBe(true);
    const del = foldShoppingList(out, [makeOp({ kind: 'shopping.item.delete', label: 'Eggs', payload: { id: ID_B } })]);
    expect(del.items.map((i) => i.id)).toEqual([ID_A]);
    expect(list.items).toHaveLength(1);
  });
  it('folds failed and blocked ops too', () => {
    const ops = [
      makeOp({ kind: 'shopping.item.update', label: 'Eggs', payload: { id: ID_B, patch: { quantity: 6 } } }, { state: 'failed' }),
      makeOp({ kind: 'shopping.item.update', label: 'Eggs', payload: { id: ID_B, patch: { notes: 'n' } } }, { state: 'blocked' }),
    ];
    expect(foldShoppingList(list, ops).items[0]).toMatchObject({ quantity: 6, notes: 'n' });
  });
  it('ignores pantry ops and does not duplicate an existing created item', () => {
    const ops = [
      makeOp({ kind: 'pantry.adjust', label: 'x', payload: { id: ID_A, delta: 1 } }),
      makeOp({ kind: 'shopping.item.create', label: 'Eggs', payload: { item: { id: ID_B, itemName: 'Eggs' } } }),
    ];
    const out = foldShoppingList(list, ops);
    expect(out.items).toHaveLength(1);
    expect(out.items[0].quantity).toBe(12);
  });
});

describe('foldPantryList', () => {
  const adj = (d: number): NewOp => ({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: d } });
  it('adjusts decimal-safe and clamps at 0', () => {
    expect(foldPantryList([pantry(0.1)], [makeOp(adj(0.2))])[0].quantity).toBe(0.3);
    expect(foldPantryList([pantry(1)], [makeOp(adj(-5))])[0].quantity).toBe(0);
  });
  it('updates, deletes and creates', () => {
    const upd = makeOp({ kind: 'pantry.update', label: 'Rice', payload: { id: ID_A, patch: { notes: 'hi' } } });
    expect(foldPantryList([pantry(1)], [upd])[0].notes).toBe('hi');
    const del = makeOp({ kind: 'pantry.delete', label: 'Rice', payload: { id: ID_A } });
    expect(foldPantryList([pantry(1)], [del])).toEqual([]);
    const cr = makeOp({ kind: 'pantry.create', label: 'Oil', payload: { item: { id: ID_B, ingredientName: 'Oil', category: 'other', quantity: 1, unit: 'liters' } } });
    expect(foldPantryList([], [cr])).toMatchObject([{ id: ID_B, userId: 'u1', ingredientName: 'Oil' }]);
  });
});

describe('foldMealPlans', () => {
  const plan = { id: 'P', meals: [{ id: ID_A, cookedAt: null }, { id: ID_B, cookedAt: null }] } as unknown as MealPlan;
  it('sets cookedAt for mealPlanItemId target only', () => {
    const at = '2026-01-01T10:00:00.000Z';
    const ops = [
      makeOp({ kind: 'cook.apply', label: 'Soup', payload: { target: { mealPlanItemId: ID_A }, servings: 2, occurredAt: at } }),
      makeOp({ kind: 'cook.apply', label: 'Stew', payload: { target: { recipeId: ID_B }, servings: 2, occurredAt: at } }),
    ];
    const out = foldMealPlans([plan], ops);
    expect(out[0].meals.map((m) => m.cookedAt)).toEqual([at, null]);
    expect(plan.meals[0].cookedAt).toBeNull();
  });
});
