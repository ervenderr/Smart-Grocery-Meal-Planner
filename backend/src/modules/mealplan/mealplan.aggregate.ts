/**
 * Pure, exact aggregation of meal plan ingredients across recipes.
 * Groups by canonical name + unit family (INT-02); math is Decimal (INT-01).
 */

import { IngredientGroup, IngredientLine, displayOf, groupIngredients } from '../intelligence/merge-groups';
import { Dec, finalizeQuantity, toDec } from '../intelligence/quantity';

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

const scaleFor = (q: Dec, itemServings: number, recipeServings: number): Dec => {
  const valid =
    Number.isFinite(itemServings) && Number.isFinite(recipeServings) && itemServings > 0 && recipeServings > 0;
  return valid ? q.times(itemServings).div(recipeServings) : q;
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

export function aggregateGroups(items: ReadonlyArray<AggregateSourceItem>): {
  groups: IngredientGroup[];
  ingredientCount: number;
} {
  const lines: IngredientLine[] = [];

  for (const item of items) {
    const list = item.recipe.ingredientsList;
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const ing = readIngredient(raw);
      if (!ing) continue;
      lines.push({
        name: ing.name,
        unit: ing.unit,
        quantity: scaleFor(toDec(ing.quantity), item.servings, item.recipe.servings),
        source: item.recipe.title,
      });
    }
  }
  return { groups: groupIngredients(lines), ingredientCount: lines.length };
}

export function aggregateIngredients(
  items: ReadonlyArray<AggregateSourceItem>,
): AggregatedIngredient[] {
  return aggregateGroups(items).groups.map((group) => {
    const display = displayOf(group);
    return {
      ingredientName: group.displayName,
      quantity: finalizeQuantity(display.quantity),
      unit: display.unit,
      recipes: [...group.sources],
    };
  });
}
