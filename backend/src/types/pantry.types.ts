/**
 * Pantry Types
 *
 * TypeScript interfaces for pantry item management.
 */

/**
 * Pantry item categories
 */
export enum PantryCategory {
  PROTEIN = 'protein',
  VEGETABLE = 'vegetable',
  FRUIT = 'fruit',
  DAIRY = 'dairy',
  GRAINS = 'grains',
  SPICES = 'spices',
  CANNED = 'canned',
  FROZEN = 'frozen',
  BEVERAGES = 'beverages',
  CONDIMENTS = 'condiments',
  OTHER = 'other',
}

/**
 * Measurement units
 */
export enum PantryUnit {
  // Weight
  LBS = 'lbs',
  KG = 'kg',
  GRAMS = 'grams',
  OZ = 'oz',

  // Volume
  CUPS = 'cups',
  ML = 'ml',
  LITERS = 'liters',
  TSP = 'tsp',
  TBSP = 'tbsp',
  FL_OZ = 'fl_oz',

  // Count
  PIECES = 'pieces',
  ITEMS = 'items',
}

/**
 * Storage locations
 */
export enum PantryLocation {
  FRIDGE = 'fridge',
  FREEZER = 'freezer',
  PANTRY = 'pantry',
  COUNTER = 'counter',
  CABINET = 'cabinet',
}

/**
 * Request to create a new pantry item
 */
export interface CreatePantryItemRequest {
  ingredientName: string;
  quantity: number;
  unit: string;
  category: string;
  expiryDate?: string; // ISO date string
  purchaseDate?: string; // ISO date string
  purchasePriceCents?: number;
  location?: string;
  notes?: string;
}

/**
 * Request to update an existing pantry item
 */
export interface UpdatePantryItemRequest {
  ingredientName?: string;
  quantity?: number;
  unit?: string;
  category?: string;
  expiryDate?: string | null; // ISO date string or null to clear
  purchaseDate?: string | null;
  purchasePriceCents?: number | null;
  location?: string | null;
  notes?: string | null;
}

/**
 * Pantry item response (what the API returns)
 */
export interface PantryItemResponse {
  id: string;
  userId: string;
  ingredientName: string;
  quantity: string; // Decimal as string for JSON
  unit: string;
  category: string;
  expiryDate: string | null; // ISO date string
  purchaseDate: string | null;
  purchasePriceCents: number | null;
  location: string | null;
  notes: string | null;
  createdAt: string; // ISO datetime string
  updatedAt: string;
  isExpired?: boolean; // Computed field
  daysUntilExpiry?: number | null; // Computed field
}

/**
 * Query parameters for getting pantry items
 */
export interface GetPantryItemsQuery {
  category?: string;
  location?: string;
  expiringSoon?: boolean; // Items expiring within 7 days
  expired?: boolean; // Only expired items
  search?: string; // Search by ingredient name
  sortBy?: 'name' | 'expiryDate' | 'quantity' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Paginated response
 */
export interface PaginatedPantryResponse {
  items: PantryItemResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Statistics about pantry items
 */
export interface PantryStats {
  totalItems: number;
  totalValue: number; // Sum of all purchase prices
  expiringWithin7Days: number;
  expired: number;
  byCategory: Record<string, number>;
  byLocation: Record<string, number>;
}
