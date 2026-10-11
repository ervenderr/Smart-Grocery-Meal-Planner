import type { MealPlan } from '@/types/mealplan.types';
import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingList } from '@/types/shopping.types';
import { COOK_PANTRY_KEY } from '@/lib/hooks/use-cook-from-pantry';
import { MEAL_PLANS_ALL_KEY, PANTRY_ALL_KEY, SHOPPING_ACTIVE_KEY, keyHash } from '../cache/cache-keys';
import { mapCookPage } from '../cache/cook-page';
import { foldMealPlans, foldPantryList, foldShoppingList } from '../outbox/fold';
import type { EntityType, OutboxOp } from '../outbox/op-types';

const SHOPPING = keyHash(SHOPPING_ACTIVE_KEY);
const PANTRY_ALL = keyHash(PANTRY_ALL_KEY);
const COOK_PANTRY = keyHash(COOK_PANTRY_KEY);
const PANTRY = new Set([PANTRY_ALL, COOK_PANTRY]);
const PLANS = keyHash(MEAL_PLANS_ALL_KEY);

/**
 * Re-applies every op still in the outbox (any state, including failed/blocked)
 * over fresh server data for a canonical key. Other keys and empty data pass through.
 */
export function reapplyForKey(key: readonly unknown[], data: unknown, ops: readonly OutboxOp[]): unknown {
  if (data === undefined || data === null) return data;
  const hash = keyHash(key);
  if (hash === SHOPPING && typeof data === 'object' && Array.isArray((data as ShoppingList).items)) {
    return foldShoppingList(data as ShoppingList, ops);
  }
  if (hash === PANTRY_ALL && Array.isArray(data)) return foldPantryList(data as PantryItem[], ops);
  if (hash === COOK_PANTRY) {
    return mapCookPage<PantryItem>(data, (items) => foldPantryList(items as PantryItem[], ops));
  }
  if (hash === PLANS && Array.isArray(data)) return foldMealPlans(data as MealPlan[], ops);
  return data;
}

const NO_TYPES: readonly EntityType[] = [];
const SHOPPING_TYPES: readonly EntityType[] = ['shopping-item', 'shopping-list'];
const PANTRY_TYPES: readonly EntityType[] = ['pantry-item', 'cook'];
const PLAN_TYPES: readonly EntityType[] = ['cook'];

/** Op entity types whose optimistic effect is folded into this key (empty: never folded). */
export function foldEntityTypes(key: readonly unknown[]): readonly EntityType[] {
  const hash = keyHash(key);
  if (hash === SHOPPING) return SHOPPING_TYPES;
  if (PANTRY.has(hash)) return PANTRY_TYPES;
  if (hash === PLANS) return PLAN_TYPES;
  return NO_TYPES;
}
