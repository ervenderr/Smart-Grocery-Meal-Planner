import { notifyManager, type QueryClient } from '@tanstack/react-query';
import type { SqlDb } from '../sql/types';
import type { BootstrapSnapshot } from './bootstrap-client';
import { writeCacheMeta } from './cache-meta';
import {
  PANTRY_ALL_KEY,
  RECIPES_ALL_KEY,
  MEAL_PLANS_ALL_KEY,
  SHOPPING_ACTIVE_KEY,
} from './cache-keys';
import { COOK_PANTRY_KEY, COOK_RECIPES_KEY } from '@/lib/hooks/use-cook-from-pantry';
import { normalizePantryItem } from '@/lib/pantry/normalize';

export interface ApplySnapshotArgs {
  queryClient: QueryClient;
  snapshot: BootstrapSnapshot;
  db: SqlDb;
  reapply: (key: readonly unknown[], data: unknown) => unknown;
}

/** Applies a complete snapshot to canonical keys in one synchronous batch. */
export async function applySnapshot({
  queryClient,
  snapshot,
  db,
  reapply,
}: ApplySnapshotArgs): Promise<void> {
  const pantry = snapshot.pantry.map(normalizePantryItem);
  const writes: ReadonlyArray<readonly [readonly unknown[], unknown]> = [
    [PANTRY_ALL_KEY, pantry],
    [COOK_PANTRY_KEY, pantry],
    [RECIPES_ALL_KEY, snapshot.recipes],
    [COOK_RECIPES_KEY, snapshot.recipes],
    [MEAL_PLANS_ALL_KEY, snapshot.mealPlans],
    ...(snapshot.shoppingList
      ? ([[SHOPPING_ACTIVE_KEY, snapshot.shoppingList]] as const)
      : []),
  ];
  notifyManager.batch(() => {
    for (const [key, data] of writes) {
      queryClient.setQueryData(key as unknown[], reapply(key, data));
    }
  });
  await writeCacheMeta(db, { lastBootstrapAt: snapshot.serverTime });
}
