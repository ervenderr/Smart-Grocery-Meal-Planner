/** Cook module request/response types. */

import type { CookRow } from '../modules/cook/cook.plan';

export interface CookPreviewInput {
  readonly recipeId: string;
  readonly servings?: number;
}

export interface CookPreviewResponse {
  readonly recipe: { readonly id: string; readonly title: string; readonly servings: number };
  readonly servings: number;
  readonly rows: CookRow[];
  readonly notInPantry: string[];
  readonly staples: string[];
  readonly ingredientCount: number;
  readonly mealPlanItemId: string | null;
  readonly alreadyCooked: boolean;
}

export interface CookDeductionInput {
  readonly key: string;
  readonly unit: string;
  readonly use: number;
}

export interface CookApplyInput {
  readonly recipeId: string;
  readonly deductions: readonly CookDeductionInput[];
}

export interface CookApplyResponse {
  readonly updated: number;
  readonly usedUp: number;
  readonly skipped: number;
}
