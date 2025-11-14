/**
 * Pantry Types
 */

export type PantryItemUnit =
  | 'lbs' | 'kg' | 'grams' | 'oz'
  | 'cups' | 'ml' | 'liters' | 'tsp' | 'tbsp' | 'fl_oz'
  | 'pieces' | 'items';

export type PantryItemCategory =
  | 'protein'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'grains'
  | 'spices'
  | 'canned'
  | 'frozen'
  | 'beverages'
  | 'condiments'
  | 'other';

export type PantryItemLocation =
  | 'fridge'
  | 'freezer'
  | 'pantry'
  | 'counter'
  | 'cabinet';

export interface PantryItem {
  id: string;
  userId: string;
  ingredientName: string;
  category: PantryItemCategory;
  quantity: number;
  unit: PantryItemUnit;
  expiryDate?: string | null;
  purchaseDate?: string | null;
  location?: PantryItemLocation | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  isExpired?: boolean;
  daysUntilExpiry?: number | null;
}

export interface CreatePantryItemData {
  ingredientName: string;
  category: PantryItemCategory;
  quantity: number;
  unit: PantryItemUnit;
  expiryDate?: string;
  purchaseDate?: string;
  location?: PantryItemLocation;
  notes?: string;
}

export interface UpdatePantryItemData {
  ingredientName?: string;
  category?: PantryItemCategory;
  quantity?: number;
  unit?: PantryItemUnit;
  expiryDate?: string | null;
  purchaseDate?: string | null;
  location?: PantryItemLocation | null;
  notes?: string | null;
}

export interface PantryItemsResponse {
  items: PantryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ExpiringItem {
  item: PantryItem;
  daysUntilExpiry: number;
  status: 'expired' | 'critical' | 'warning' | 'ok';
}
