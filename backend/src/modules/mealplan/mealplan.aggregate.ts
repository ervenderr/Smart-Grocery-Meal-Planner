/**
 * Pure aggregation of meal plan ingredients across recipes.
 */

export interface AggregateSourceItem {
  readonly servings: number;
  readonly recipe: {
    readonly servings: number;
    readonly title: string;
    readonly ingredientsList: unknown;
  };
}

export interface AggregatedIngredient {
  readonly ingredientName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly recipes: string[];
}

interface Accumulator {
  readonly ingredientName: string;
  readonly unit: string;
  quantity: number;
  readonly recipes: Set<string>;
}

const KEY_SEPARATOR = '\u0000';

const multiplierFor = (itemServings: number, recipeServings: number): number => {
  const ratio = itemServings / recipeServings;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
};

const readIngredient = (
  raw: unknown,
): { name: string; unit: string; quantity: number } | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.ingredientName === 'string' ? r.ingredientName.trim() : '';
  const quantity = typeof r.quantity === 'number' ? r.quantity : NaN;
  if (name.length === 0 || !Number.isFinite(quantity) || quantity < 0) return null;
  const unit = typeof r.unit === 'string' ? r.unit.trim() : '';
  return { name, unit, quantity };
};

export function aggregateIngredients(
  items: ReadonlyArray<AggregateSourceItem>,
): AggregatedIngredient[] {
  const map = new Map<string, Accumulator>();

  for (const item of items) {
    const list = item.recipe.ingredientsList;
    if (!Array.isArray(list)) continue;
    const multiplier = multiplierFor(item.servings, item.recipe.servings);

    for (const raw of list) {
      const ing = readIngredient(raw);
      if (!ing) continue;
      const key = `${ing.name.toLowerCase()}${KEY_SEPARATOR}${ing.unit.toLowerCase()}`;
      const scaled = ing.quantity * multiplier;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += scaled;
        existing.recipes.add(item.recipe.title);
      } else {
        map.set(key, {
          ingredientName: ing.name,
          unit: ing.unit,
          quantity: scaled,
          recipes: new Set([item.recipe.title]),
        });
      }
    }
  }

  return Array.from(map.values()).map((acc) => ({
    ingredientName: acc.ingredientName,
    quantity: Math.round(acc.quantity * 100) / 100,
    unit: acc.unit,
    recipes: Array.from(acc.recipes),
  }));
}
