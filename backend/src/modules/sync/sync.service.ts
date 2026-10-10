/**
 * Sync bootstrap service: keyset-paged snapshot of everything the app caches.
 *
 * Sections are walked in order pantry -> recipes -> mealPlans; a page never
 * mixes sections. Pages are NOT snapshot-consistent (rows may change between
 * calls); this is a documented trade-off, delta pull arrives in Phase 11.
 */

import { prisma } from '../../config/database.config';
import type { BootstrapPage, SyncCursor, SyncSection } from '../../types/sync.types';
import { formatMealPlan } from '../mealplan/mealplan.format';
import { formatPantryItem } from '../pantry/pantry.format';
import { toRecipeResponse } from '../recipe/recipe.format';
import { ShoppingService } from '../shopping/shopping.service';
import { encodeCursor } from './sync.cursor';

const shoppingService = new ShoppingService();

interface SectionPage {
  readonly rows: readonly { id: string }[];
  readonly items: readonly unknown[];
}

const keyset = (userId: string, after: string | null) => ({
  userId,
  deletedAt: null,
  ...(after ? { id: { gt: after } } : {}),
});

async function pantryPage(userId: string, after: string | null, take: number): Promise<SectionPage> {
  const rows = await prisma.pantryItem.findMany({
    where: keyset(userId, after),
    orderBy: { id: 'asc' },
    take,
  });
  return { rows, items: rows.map(formatPantryItem) };
}

async function recipesPage(userId: string, after: string | null, take: number): Promise<SectionPage> {
  const rows = await prisma.recipe.findMany({
    where: keyset(userId, after),
    orderBy: { id: 'asc' },
    take,
  });
  return { rows, items: rows.map(toRecipeResponse) };
}

async function mealPlansPage(userId: string, after: string | null, take: number): Promise<SectionPage> {
  const rows = await prisma.mealPlan.findMany({
    where: keyset(userId, after),
    orderBy: { id: 'asc' },
    take,
    include: {
      mealPlanItems: {
        include: {
          recipe: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              prepTimeMinutes: true,
              cookTimeMinutes: true,
            },
          },
        },
      },
    },
  });
  return { rows, items: rows.map((plan) => formatMealPlan(plan)) };
}

const SECTION_ORDER: readonly SyncSection[] = ['pantry', 'recipes', 'mealPlans'];

const LOADERS: Record<
  SyncSection,
  (userId: string, after: string | null, take: number) => Promise<SectionPage>
> = { pantry: pantryPage, recipes: recipesPage, mealPlans: mealPlansPage };

function nextCursorFor(section: SyncSection, hasMore: boolean, lastId: string | null): string | null {
  if (hasMore && lastId) return encodeCursor({ s: section, after: lastId });
  const next = SECTION_ORDER[SECTION_ORDER.indexOf(section) + 1];
  return next ? encodeCursor({ s: next, after: null }) : null;
}

export async function getBootstrapPage(
  userId: string,
  cursor: SyncCursor | null,
  limit: number
): Promise<BootstrapPage> {
  const section = cursor?.s ?? 'pantry';
  const page = await LOADERS[section](userId, cursor?.after ?? null, limit + 1);
  const hasMore = page.rows.length > limit;
  const rows = hasMore ? page.rows.slice(0, limit) : page.rows;
  const items = hasMore ? page.items.slice(0, limit) : page.items;
  const lastId = rows.length > 0 ? rows[rows.length - 1].id : null;

  return {
    serverTime: new Date().toISOString(),
    section,
    items,
    nextCursor: nextCursorFor(section, hasMore, lastId),
    ...(cursor === null && { shoppingList: await shoppingService.getActiveList(userId) }),
  };
}
