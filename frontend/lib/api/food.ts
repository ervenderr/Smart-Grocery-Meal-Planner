import { apiClient } from './client';
import type { PantryItemCategory } from '@/types/pantry.types';

export interface FoodAttribution {
  name: string;
  url: string;
  license: string;
  note: string;
}

export interface NutritionPer100g {
  energyKcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

export interface FoodProduct {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  imageUrl: string | null;
  suggestedCategory: PantryItemCategory;
  nutritionPer100g: NutritionPer100g;
}

export interface BarcodeLookupResponse {
  product: FoodProduct;
  attribution: FoodAttribution;
  cached: boolean;
}

export interface NutritionResult {
  fdcId: number;
  description: string;
  dataType: string;
  nutritionPer100g: NutritionPer100g;
}

export interface NutritionSearchResponse {
  results: NutritionResult[];
  attribution: FoodAttribution;
  cached: boolean;
}

const LOOKUP_TIMEOUT_MS = 15000;

export const foodApi = {
  async lookupBarcode(code: string): Promise<BarcodeLookupResponse> {
    return await apiClient.get<BarcodeLookupResponse>(
      `/api/v1/food/barcode/${encodeURIComponent(code)}`,
      { timeout: LOOKUP_TIMEOUT_MS }
    );
  },

  async searchNutrition(query: string): Promise<NutritionSearchResponse> {
    return await apiClient.get<NutritionSearchResponse>('/api/v1/food/nutrition', {
      params: { query },
      timeout: LOOKUP_TIMEOUT_MS,
    });
  },
};
