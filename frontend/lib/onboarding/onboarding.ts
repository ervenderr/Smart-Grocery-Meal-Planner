import type { CreatePantryItemData, PantryItemCategory } from '@/types/pantry.types';
import type { UserPreferences } from '@/types/preferences.types';

export const MAX_ONBOARDING_ITEMS = 10;
export const MAX_ITEM_NAME_LENGTH = 100;

export interface PantrySuggestion {
  readonly name: string;
  readonly category: PantryItemCategory;
}

export const PANTRY_SUGGESTIONS: ReadonlyArray<PantrySuggestion> = [
  { name: 'Rice', category: 'grains' },
  { name: 'Eggs', category: 'protein' },
  { name: 'Milk', category: 'dairy' },
  { name: 'Onions', category: 'vegetable' },
  { name: 'Garlic', category: 'vegetable' },
  { name: 'Cooking oil', category: 'other' },
  { name: 'Soy sauce', category: 'spices' },
  { name: 'Chicken', category: 'protein' },
  { name: 'Bread', category: 'grains' },
  { name: 'Canned tuna', category: 'protein' },
];

/**
 * Show onboarding only when the server explicitly reports null.
 * Missing preferences or a missing field (older backend) fail open.
 */
export function shouldShowOnboarding(prefs?: UserPreferences): boolean {
  if (!prefs) return false;
  return 'onboardingCompletedAt' in prefs && prefs.onboardingCompletedAt === null;
}

function normalizeName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > MAX_ITEM_NAME_LENGTH) return null;
  return trimmed;
}

export function buildOnboardingItem(name: string): CreatePantryItemData | null {
  const trimmed = normalizeName(name);
  if (trimmed === null) return null;
  const match = PANTRY_SUGGESTIONS.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  return {
    ingredientName: trimmed,
    category: match?.category ?? 'other',
    quantity: 1,
    unit: 'pieces',
  };
}

export function addOnboardingItem(list: ReadonlyArray<string>, name: string): string[] {
  const trimmed = normalizeName(name);
  if (trimmed === null || list.length >= MAX_ONBOARDING_ITEMS) return [...list];
  const exists = list.some((n) => n.toLowerCase() === trimmed.toLowerCase());
  return exists ? [...list] : [...list, trimmed];
}

export function removeOnboardingItem(list: ReadonlyArray<string>, name: string): string[] {
  const target = name.toLowerCase();
  return list.filter((n) => n.toLowerCase() !== target);
}
