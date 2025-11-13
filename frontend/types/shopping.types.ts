/**
 * Shopping List Types
 */

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  itemName: string;
  quantity: number;
  unit: string;
  costEstimateCents: number | null;
  actualCostCents: number | null;
  category: string | null;
  isChecked: boolean;
  substituteSuggestion: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingList {
  id: string;
  userId: string;
  mealPlanId: string | null;
  name: string;
  totalCostCents: number | null;
  totalGeminiUnits: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  items: ShoppingListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListItemInput {
  itemName: string;
  quantity: number;
  unit: string;
  costEstimateCents?: number;
  category?: string;
  substituteSuggestion?: string;
  notes?: string;
}

export interface CreateShoppingListData {
  name: string;
  mealPlanId?: string;
  notes?: string;
  items?: ShoppingListItemInput[];
}

export interface UpdateShoppingListData {
  name?: string;
  isCompleted?: boolean;
  items?: ShoppingListItemInput[];
}

export interface UpdateShoppingListItemData {
  isChecked?: boolean;
  actualCostCents?: number;
  notes?: string;
}

export interface ShoppingListsResponse {
  items: ShoppingList[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ShoppingListFilters {
  isCompleted?: boolean;
  sortBy?: 'name' | 'createdAt' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// For meal plan generated shopping lists
export interface MealPlanShoppingListItem {
  ingredientName: string;
  quantity: number;
  unit: string;
  recipes: string[];
}

export interface MealPlanShoppingList {
  items: MealPlanShoppingListItem[];
  totalEstimatedCostCents: number | null;
}

export type ShoppingItemCategory =
  | 'produce'
  | 'protein'
  | 'dairy'
  | 'grains'
  | 'frozen'
  | 'canned'
  | 'beverages'
  | 'snacks'
  | 'condiments'
  | 'other';
