/**
 * Shopping module DTO and input contracts (phase 04).
 */

import type { CoveredEntry } from '../modules/intelligence/pantry-subtract';

export interface ShoppingItemDto {
  readonly id: string;
  readonly shoppingListId: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly category: string;
  readonly costEstimateCents: number | null;
  readonly actualCostCents: number | null;
  readonly isChecked: boolean;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ShoppingListDto {
  readonly id: string;
  readonly name: string;
  readonly mealPlanId: string | null;
  readonly isCompleted: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly ShoppingItemDto[];
}

export interface CreateShoppingItemInput {
  readonly itemName: string;
  readonly quantity?: number;
  readonly unit?: string;
  readonly category?: string | null;
  readonly costEstimateCents?: number | null;
  readonly actualCostCents?: number | null;
  readonly isChecked?: boolean;
  readonly notes?: string | null;
}

export type UpdateShoppingItemInput = Partial<CreateShoppingItemInput>;

export type CarryOverMode = 'carry' | 'discard';

export interface GenerateFromMealPlanResult {
  readonly list: ShoppingListDto;
  readonly added: number;
  readonly merged: number;
  readonly covered: ReadonlyArray<CoveredEntry>;
  readonly skippedStaples: ReadonlyArray<string>;
  readonly pantryCapped: boolean;
}

export interface ShoppingHistoryEntryDto {
  readonly id: string;
  /** YYYY-MM-DD */
  readonly receiptDate: string;
  readonly totalCents: number;
  readonly estimatedCents: number;
  readonly itemCount: number;
  readonly listName: string | null;
  readonly shoppingListId: string | null;
}

export interface FinishShoppingResult {
  readonly history: ShoppingHistoryEntryDto;
  readonly list: ShoppingListDto;
  /** Present only when the request set addToPantry. */
  readonly pantry?: {
    readonly added: number;
    readonly merged: number;
    readonly failed: boolean;
  };
}

/** Checked list item as finished (internal; never serialized to the client). */
export interface FinishedCheckedItem {
  readonly itemName: string;
  readonly quantity: unknown;
  readonly unit: string | null;
  readonly category: string | null;
  readonly actualCostCents: number | null;
  readonly costEstimateCents: number | null;
}

/** Internal finish outcome: the HTTP result plus data for the after-commit pantry step. */
export interface FinishShoppingOutcome {
  readonly result: FinishShoppingResult;
  readonly checkedItems: readonly FinishedCheckedItem[];
  readonly receiptDate: Date;
}

export interface ShoppingHistoryPage {
  readonly items: readonly ShoppingHistoryEntryDto[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}
