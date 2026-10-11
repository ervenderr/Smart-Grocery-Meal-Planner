// Tests only.
import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingList } from '@/types/shopping.types';
import type { MealPlan } from '@/types/mealplan.types';

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const ID_C = '5f2b8a52-8c1e-4c6e-9a53-1f0e5d3b7a12';

export const shoppingList = (): ShoppingList =>
  deepFreeze({
    id: 'L', name: 'List', mealPlanId: null, isCompleted: false, createdAt: 'x', updatedAt: 'x',
    items: [{ id: '4f2b8a52-8c1e-4c6e-9a53-1f0e5d3b7a11', shoppingListId: 'L', itemName: 'Eggs', quantity: 12, unit: 'pcs', category: 'dairy', costEstimateCents: null, actualCostCents: null, isChecked: false, notes: null, createdAt: 'x', updatedAt: 'x' }],
  } as ShoppingList);

export const pantryItem = (q: number): PantryItem =>
  ({ id: '3f2b8a52-8c1e-4c6e-9a53-1f0e5d3b7a10', userId: 'u1', ingredientName: 'Rice', category: 'grains', quantity: q, unit: 'kg', createdAt: 'x', updatedAt: 'x' }) as PantryItem;

export const mealPlans = (): MealPlan[] =>
  deepFreeze([
    { id: 'mp', userId: 'u1', name: 'W', startDate: 'x', endDate: 'y', totalCostCents: null, totalCalories: null, isFavorite: false, notes: null, createdAt: 'x', updatedAt: 'x',
      meals: [{ id: ID_C, cookedAt: null }] },
  ] as unknown as MealPlan[]);
