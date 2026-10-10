/**
 * Sync bootstrap types.
 */

import type { ShoppingListDto } from './shopping.types';

export type SyncSection = 'pantry' | 'recipes' | 'mealPlans';

export interface SyncCursor {
  readonly s: SyncSection;
  readonly after: string | null;
}

export interface BootstrapPage {
  readonly serverTime: string;
  readonly section: SyncSection;
  readonly items: readonly unknown[];
  readonly nextCursor: string | null;
  readonly shoppingList?: ShoppingListDto;
}
