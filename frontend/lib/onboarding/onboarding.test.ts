import { describe, expect, it } from 'vitest';
import type { UserPreferences } from '@/types/preferences.types';
import {
  MAX_ONBOARDING_ITEMS,
  PANTRY_SUGGESTIONS,
  addOnboardingItem,
  buildOnboardingItem,
  removeOnboardingItem,
  shouldShowOnboarding,
} from './onboarding';

const basePrefs: UserPreferences = {
  id: 'p1',
  userId: 'u1',
  currency: 'PHP',
  budgetPerWeekCents: 0,
  alertEnabled: true,
  alertThresholdPercentage: 80,
  alertChannels: [],
  mealsPerDay: 3,
  dietaryRestrictions: [],
  preferredUnit: 'metric',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('shouldShowOnboarding', () => {
  it('is false when preferences are not loaded', () => {
    expect(shouldShowOnboarding(undefined)).toBe(false);
  });

  it('is false when an old backend omits the field (fail open)', () => {
    expect(shouldShowOnboarding({ ...basePrefs })).toBe(false);
  });

  it('is true only when the field is null', () => {
    expect(shouldShowOnboarding({ ...basePrefs, onboardingCompletedAt: null })).toBe(true);
  });

  it('is false when completed', () => {
    expect(
      shouldShowOnboarding({ ...basePrefs, onboardingCompletedAt: '2026-02-01T00:00:00.000Z' })
    ).toBe(false);
  });
});

describe('PANTRY_SUGGESTIONS', () => {
  it('has the 10 specified entries', () => {
    expect(PANTRY_SUGGESTIONS.map((s) => [s.name, s.category])).toEqual([
      ['Rice', 'grains'],
      ['Eggs', 'protein'],
      ['Milk', 'dairy'],
      ['Onions', 'vegetable'],
      ['Garlic', 'vegetable'],
      ['Cooking oil', 'other'],
      ['Soy sauce', 'spices'],
      ['Chicken', 'protein'],
      ['Bread', 'grains'],
      ['Canned tuna', 'protein'],
    ]);
  });
});

describe('buildOnboardingItem', () => {
  it('uses the suggestion category with pieces and quantity 1', () => {
    expect(buildOnboardingItem('Eggs')).toEqual({
      ingredientName: 'Eggs',
      category: 'protein',
      quantity: 1,
      unit: 'pieces',
    });
  });

  it('trims and falls back to other for unknown names', () => {
    const item = buildOnboardingItem('  dragon fruit ');
    expect(item?.ingredientName).toBe('dragon fruit');
    expect(item?.category).toBe('other');
  });

  it('rejects blank and over-long names', () => {
    expect(buildOnboardingItem('   ')).toBeNull();
    expect(buildOnboardingItem('a'.repeat(101))).toBeNull();
    expect(buildOnboardingItem('a'.repeat(100))).not.toBeNull();
  });
});

describe('addOnboardingItem / removeOnboardingItem', () => {
  it('dedupes case-insensitively without mutating the input', () => {
    const list = ['Eggs'];
    const next = addOnboardingItem(list, 'eggs');
    expect(next).toEqual(['Eggs']);
    expect(next).not.toBe(list);
    expect(list).toEqual(['Eggs']);
  });

  it('adds a trimmed new item immutably', () => {
    const list = ['Eggs'];
    const next = addOnboardingItem(list, ' Milk ');
    expect(next).toEqual(['Eggs', 'Milk']);
    expect(list).toEqual(['Eggs']);
  });

  it('ignores invalid names', () => {
    expect(addOnboardingItem(['Eggs'], '  ')).toEqual(['Eggs']);
  });

  it('stops at the max', () => {
    const full = Array.from({ length: MAX_ONBOARDING_ITEMS }, (_, i) => `Item ${i}`);
    const next = addOnboardingItem(full, 'Extra');
    expect(next).toEqual(full);
    expect(MAX_ONBOARDING_ITEMS).toBe(10);
  });

  it('removes immutably', () => {
    const list = ['Eggs', 'Milk'];
    const next = removeOnboardingItem(list, 'Eggs');
    expect(next).toEqual(['Milk']);
    expect(list).toEqual(['Eggs', 'Milk']);
  });
});
