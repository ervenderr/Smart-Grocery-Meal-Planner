import type { MealPlan } from '@/types/mealplan.types';
import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingList } from '@/types/shopping.types';
import { COOK_PANTRY_KEY } from '@/lib/hooks/use-cook-from-pantry';
import { MEAL_PLANS_ALL_KEY, PANTRY_ALL_KEY, SHOPPING_ACTIVE_KEY } from '../cache/cache-keys';

export type CacheWrite = { key: readonly unknown[]; update: (old: unknown) => unknown };
export type CacheWrites = ReadonlyArray<CacheWrite>;

const isList = (v: unknown): v is ShoppingList =>
  !!v && typeof v === 'object' && Array.isArray((v as ShoppingList).items);

/** Wraps a typed updater so it tolerates undefined/mismatched old data (returns it unchanged). */
export const shoppingWrite = (fn: (list: ShoppingList) => ShoppingList | undefined): CacheWrite => ({
  key: SHOPPING_ACTIVE_KEY,
  update: (old) => (isList(old) ? (fn(old) ?? old) : old),
});

export const pantryWrites = (fn: (items: readonly PantryItem[]) => PantryItem[]): CacheWrites =>
  [PANTRY_ALL_KEY, COOK_PANTRY_KEY].map((key) => ({
    key,
    update: (old: unknown) => (Array.isArray(old) ? fn(old as PantryItem[]) : old),
  }));

export const mealPlanWrite = (fn: (plans: readonly MealPlan[]) => MealPlan[]): CacheWrite => ({
  key: MEAL_PLANS_ALL_KEY,
  update: (old) => (Array.isArray(old) ? fn(old as MealPlan[]) : old),
});
