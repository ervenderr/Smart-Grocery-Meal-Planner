/**
 * Per-feature dietary filtering. Applied after the provider/cache step so the
 * cache stays user-independent. Each function returns a new value.
 */

import { partitionByRestrictions } from '../dietary-filter';
import type { MealPlanSuggestion } from './meal-plan';
import type { RecipeSuggestion } from './recipes';
import type { Substitution } from './substitutions';

export interface Filtered<T> {
  readonly result: T;
  readonly filteredOut: number;
}

export function filterRecipeSuggestions(
  list: readonly RecipeSuggestion[],
  restrictions: readonly string[]
): Filtered<readonly RecipeSuggestion[]> {
  const { kept, removedCount } = partitionByRestrictions(
    list,
    (r) => [r.name, ...r.ingredients.map((i) => i.ingredientName)],
    restrictions
  );
  return { result: kept, filteredOut: removedCount };
}

export function filterMealPlan(
  plan: MealPlanSuggestion,
  restrictions: readonly string[]
): Filtered<MealPlanSuggestion> {
  const { kept, removedCount } = partitionByRestrictions(
    plan.meals,
    (m) => [m.recipeName, ...m.ingredients],
    restrictions
  );
  return { result: { ...plan, meals: [...kept] }, filteredOut: removedCount };
}

export function filterSubstitutions(
  list: readonly Substitution[],
  restrictions: readonly string[]
): Filtered<readonly Substitution[]> {
  const { kept, removedCount } = partitionByRestrictions(list, (s) => [s.substitute], restrictions);
  return { result: kept, filteredOut: removedCount };
}
