/** Cook ("Cooked it") API types. Mirror backend/src/types/cook.types.ts. */

export type CookRowStatus = 'ok' | 'short' | 'mismatch';

export interface CookRow {
  readonly key: string;
  readonly name: string;
  readonly unit: string;
  readonly have: number;
  readonly use: number;
  readonly left: number;
  readonly status: CookRowStatus;
  readonly recipeQuantity?: number;
  readonly recipeUnit?: string;
}

export interface CookPreview {
  readonly recipe: { readonly id: string; readonly title: string; readonly servings: number };
  readonly servings: number;
  readonly rows: CookRow[];
  readonly notInPantry: string[];
  readonly staples: string[];
  readonly ingredientCount: number;
  readonly mealPlanItemId: string | null;
  readonly alreadyCooked: boolean;
}

export type CookTarget = { recipeId: string } | { mealPlanItemId: string };

export interface CookDeduction {
  readonly key: string;
  readonly unit: string;
  readonly use: number;
}

export type CookApplyInput = CookTarget & { deductions: readonly CookDeduction[] };

export interface CookApplyResult {
  readonly updated: number;
  readonly usedUp: number;
  readonly skipped: number;
}
