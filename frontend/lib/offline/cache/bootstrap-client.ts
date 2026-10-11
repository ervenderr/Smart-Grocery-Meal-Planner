import { z } from 'zod';
import type { PantryItem } from '@/types/pantry.types';
import type { Recipe } from '@/types/recipe.types';
import type { MealPlan } from '@/types/mealplan.types';
import type { ShoppingList } from '@/types/shopping.types';

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootstrapError';
  }
}

export interface BootstrapSnapshot {
  serverTime: string;
  pantry: PantryItem[];
  recipes: Recipe[];
  mealPlans: MealPlan[];
  shoppingList: ShoppingList | null;
}

const entity = z.object({ id: z.string() }).passthrough();

const pageSchema = z.object({
  serverTime: z.string(),
  section: z.enum(['pantry', 'recipes', 'mealPlans']),
  items: z.array(entity),
  nextCursor: z.string().nullable(),
  shoppingList: z.object({ items: z.array(z.unknown()) }).passthrough().optional(),
});

export async function fetchBootstrapSnapshot(
  fetchPage: (cursor: string | null) => Promise<unknown>,
  opts: { maxPages?: number } = {},
): Promise<BootstrapSnapshot> {
  const maxPages = opts.maxPages ?? 100;
  let cursor: string | null = null;
  let serverTime = '';
  let shoppingList: ShoppingList | null = null;
  let pantry: unknown[] = [];
  let recipes: unknown[] = [];
  let mealPlans: unknown[] = [];

  for (let n = 0; n < maxPages; n++) {
    const raw = await fetchPage(cursor);
    const parsed = pageSchema.safeParse(raw);
    if (!parsed.success) throw new BootstrapError('Invalid bootstrap page');
    const p = parsed.data;
    if (n === 0) {
      serverTime = p.serverTime;
      shoppingList = (p.shoppingList as unknown as ShoppingList | undefined) ?? null;
    }
    if (p.section === 'pantry') pantry = [...pantry, ...p.items];
    else if (p.section === 'recipes') recipes = [...recipes, ...p.items];
    else mealPlans = [...mealPlans, ...p.items];

    if (p.nextCursor === null) {
      return {
        serverTime,
        pantry: pantry as PantryItem[],
        recipes: recipes as Recipe[],
        mealPlans: mealPlans as MealPlan[],
        shoppingList,
      };
    }
    cursor = p.nextCursor;
  }
  throw new BootstrapError('Bootstrap exceeded max pages');
}
