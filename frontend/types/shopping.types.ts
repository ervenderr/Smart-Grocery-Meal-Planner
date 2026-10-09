/**
 * Shopping list types. Mirror the backend DTOs under /api/v1/shopping.
 */

export interface ShoppingItem {
  id: string;
  shoppingListId: string;
  itemName: string;
  quantity: number;
  unit: string;
  category: string;
  costEstimateCents: number | null;
  actualCostCents: number | null;
  isChecked: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  mealPlanId: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  items: ShoppingItem[];
}

export interface CreateShoppingItemInput {
  itemName: string;
  quantity?: number;
  unit?: string;
  category?: string | null;
  costEstimateCents?: number | null;
  actualCostCents?: number | null;
  isChecked?: boolean;
  notes?: string | null;
}

export type UpdateShoppingItemInput = Partial<CreateShoppingItemInput>;

export type CarryOverMode = 'carry' | 'discard';

export interface CoveredItem {
  name: string;
  needed: number;
  have: number;
  unit: string;
  status: 'full' | 'partial' | 'incompatible' | 'on_list';
  haveUnit?: string;
}

export interface GenerateShoppingListResult {
  list: ShoppingList;
  added: number;
  merged: number;
  // Optional because an older backend omits these fields.
  covered?: CoveredItem[];
  skippedStaples?: string[];
  pantryCapped?: boolean;
}

export interface FinishShoppingInput {
  carryOver?: CarryOverMode;
  /** User's local date, YYYY-MM-DD */
  receiptDate?: string;
}

export interface ShoppingHistoryEntry {
  id: string;
  /** YYYY-MM-DD */
  receiptDate: string;
  totalCents: number;
  estimatedCents: number;
  itemCount: number;
  listName: string | null;
  shoppingListId: string | null;
}

export interface FinishShoppingResult {
  history: ShoppingHistoryEntry;
  list: ShoppingList;
}

export interface ShoppingHistoryPage {
  items: ShoppingHistoryEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
