import { describe, expect, it } from 'vitest';
import { reapplyForKey } from './reapply';
import { makeOp, ID_A, ID_B } from '../outbox/fixtures.test-helper';
import { COOK_PANTRY_KEY } from '@/lib/hooks/use-cook-from-pantry';
import { MEAL_PLANS_ALL_KEY, PANTRY_ALL_KEY, SHOPPING_ACTIVE_KEY, RECIPES_ALL_KEY } from '../cache/cache-keys';
import { deepFreeze, ID_C, mealPlans, pantryItem, shoppingList } from './fixtures.test-helper';
import type { ShoppingList } from '@/types/shopping.types';
import type { PantryItem } from '@/types/pantry.types';
import type { MealPlan } from '@/types/mealplan.types';

describe('reapplyForKey', () => {
  it('re-adds an offline-created shopping item over a fresh snapshot', () => {
    const ops = [makeOp({ kind: 'shopping.item.create', label: 'Milk', payload: { item: { id: ID_A, itemName: 'Milk' } } })];
    const out = reapplyForKey(SHOPPING_ACTIVE_KEY, shoppingList(), ops) as ShoppingList;
    expect(out.items.map((i) => i.id)).toContain(ID_A);
  });
  it('applies a pending check toggle', () => {
    const ops = [makeOp({ kind: 'shopping.item.update', label: 'Eggs', payload: { id: ID_B, patch: { isChecked: true } } })];
    const out = reapplyForKey(SHOPPING_ACTIVE_KEY, shoppingList(), ops) as ShoppingList;
    expect(out.items[0].isChecked).toBe(true);
  });
  it('still re-applies a failed (parked) op', () => {
    const ops = [makeOp({ kind: 'shopping.item.update', label: 'Eggs', payload: { id: ID_B, patch: { quantity: 2 } } }, { state: 'failed' })];
    expect((reapplyForKey(SHOPPING_ACTIVE_KEY, shoppingList(), ops) as ShoppingList).items[0].quantity).toBe(2);
  });
  it('clamps pantry adjust at zero for both pantry keys', () => {
    const ops = [makeOp({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: -5 } })];
    const data = deepFreeze([pantryItem(3)]);
    expect((reapplyForKey(PANTRY_ALL_KEY, data, ops) as PantryItem[])[0].quantity).toBe(0);
    expect((reapplyForKey(COOK_PANTRY_KEY, data, ops) as { items: PantryItem[] }).items[0].quantity).toBe(0);
  });
  it('folds pending ops into the cook key page shape, keeping capped', () => {
    const ops = [makeOp({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: -1 } })];
    const page = deepFreeze({ items: [pantryItem(3)], capped: true });
    const out = reapplyForKey(COOK_PANTRY_KEY, page, ops) as { items: PantryItem[]; capped: boolean };
    expect(out.items[0].quantity).toBe(2);
    expect(out.capped).toBe(true);
  });
  it('marks the meal as cooked', () => {
    const ops = [makeOp({ kind: 'cook.apply', label: 'Cook', payload: { target: { mealPlanItemId: ID_C }, servings: 1, occurredAt: '2026-10-11T10:00:00.000Z' } })];
    const out = reapplyForKey(MEAL_PLANS_ALL_KEY, mealPlans(), ops) as MealPlan[];
    expect(out[0].meals[0].cookedAt).toBe('2026-10-11T10:00:00.000Z');
  });
  it('returns non-canonical keys and non-array data unchanged', () => {
    const data = { a: 1 };
    expect(reapplyForKey(RECIPES_ALL_KEY, data, [])).toBe(data);
    expect(reapplyForKey(PANTRY_ALL_KEY, undefined, [])).toBeUndefined();
    expect(reapplyForKey(SHOPPING_ACTIVE_KEY, null, [])).toBeNull();
  });
});
