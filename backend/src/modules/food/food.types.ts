export interface NutritionPer100g {
  readonly energyKcal: number | null;
  readonly protein: number | null;
  readonly fat: number | null;
  readonly carbs: number | null;
}

export type PantryCategory =
  | 'protein' | 'vegetable' | 'fruit' | 'dairy' | 'grains' | 'spices'
  | 'canned' | 'frozen' | 'beverages' | 'condiments' | 'other';

export interface FoodProduct {
  readonly barcode: string;
  readonly name: string;
  readonly brand: string | null;
  readonly quantity: string | null;
  readonly imageUrl: string | null;
  readonly suggestedCategory: PantryCategory;
  readonly nutritionPer100g: NutritionPer100g;
}

export interface UsdaResult {
  readonly fdcId: number;
  readonly description: string;
  readonly dataType: string;
  readonly nutritionPer100g: NutritionPer100g;
}
