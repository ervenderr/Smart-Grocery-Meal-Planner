/**
 * Offline rules engine contracts (pure types, no runtime code).
 * Consumed by units, diet, match, rank and substitute modules.
 */

export type UnitFamily = 'mass' | 'volume' | 'count';

export interface ResolvedUnit {
  readonly family: UnitFamily;
  readonly unitKey: string;
  readonly label: string;
  readonly factor: number | null;
  readonly system: 'metric' | 'us' | null;
}

export interface RulesPantryItem {
  readonly id: string;
  readonly ingredientName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly expiryDate: string | null;
}

export interface RulesRecipeIngredient {
  readonly ingredientName: string;
  readonly quantity: number;
  readonly unit: string;
}

export interface RulesRecipe {
  readonly id: string;
  readonly name: string;
  readonly totalTimeMinutes: number;
  readonly servings: number;
  readonly ingredients: readonly RulesRecipeIngredient[];
}

export type MatchStatus = 'have' | 'partial' | 'unitMismatch' | 'staple' | 'missing';

export interface IngredientMatch {
  readonly name: string;
  readonly canonical: string;
  readonly needed: number;
  readonly unit: string;
  readonly have: number;
  readonly haveUnit: string;
  readonly status: MatchStatus;
  readonly daysLeft: number | null;
  readonly hasSubstitute: boolean;
}

export interface ExpiringUse {
  readonly name: string;
  readonly daysLeft: number;
}

export interface RankedRecipe {
  readonly recipeId: string;
  readonly name: string;
  readonly totalTimeMinutes: number;
  readonly servings: number;
  readonly rank: number;
  readonly coveragePercent: number;
  readonly totalCount: number;
  readonly haveCount: number;
  readonly missingCount: number;
  readonly readyToCook: boolean;
  readonly expiryBoost: number;
  readonly score: number;
  readonly have: readonly IngredientMatch[];
  readonly missing: readonly IngredientMatch[];
  readonly expiringUsed: readonly ExpiringUse[];
}

export interface RulesContext {
  /** YYYY-MM-DD */
  readonly today: string;
  readonly staples: ReadonlySet<string>;
  readonly restrictions: readonly string[];
  readonly applyDiet: boolean;
  readonly onlyReady: boolean;
  readonly quantityAware?: boolean;
  readonly hasSubstitute?: (canonical: string) => boolean;
}

export interface RankResult {
  readonly items: readonly RankedRecipe[];
  readonly totalRecipes: number;
  readonly hiddenByDiet: number;
  readonly hiddenByReady: number;
  readonly recipesCapped: boolean;
  readonly pantryCapped: boolean;
}

export interface SubstituteQuery {
  readonly ingredientName: string;
  readonly quantity: number;
  readonly unit: string;
}

export interface SubstituteOptions {
  readonly pantryHas: (canonical: string) => boolean;
  readonly restrictions: readonly string[];
}

export interface SuggestedSwap {
  readonly name: string;
  readonly ratioLine: string;
  readonly note: string;
  readonly tags: readonly string[];
  readonly inPantry: boolean;
  readonly rank: number;
}

export interface SubstituteResult {
  readonly ingredient: string;
  readonly swaps: readonly SuggestedSwap[];
  readonly hiddenCount: number;
}
