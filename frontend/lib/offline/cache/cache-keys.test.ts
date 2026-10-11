import { describe, expect, it } from 'vitest';
import {
  PANTRY_ALL_KEY,
  RECIPES_ALL_KEY,
  MEAL_PLANS_ALL_KEY,
  SHOPPING_ACTIVE_KEY,
  PREFERENCES_KEY,
  isPersistedKey,
  keyHash,
} from './cache-keys';
import { COOK_PANTRY_KEY, COOK_RECIPES_KEY } from '@/lib/hooks/use-cook-from-pantry';

describe('isPersistedKey', () => {
  it('accepts whitelisted keys', () => {
    for (const k of [
      PANTRY_ALL_KEY,
      RECIPES_ALL_KEY,
      MEAL_PLANS_ALL_KEY,
      SHOPPING_ACTIVE_KEY,
      PREFERENCES_KEY,
      COOK_PANTRY_KEY,
      COOK_RECIPES_KEY,
      ['notifications', 'stats'],
    ]) {
      expect(isPersistedKey(k)).toBe(true);
    }
  });
  it('denies cook preview', () => {
    expect(isPersistedKey(['cook', 'preview', 'x'])).toBe(false);
  });
  it('denies ai keys', () => {
    expect(isPersistedKey(['ai', 'suggest'])).toBe(false);
    expect(isPersistedKey(['recipes', 'ai', 'x'])).toBe(false);
  });
  it('denies shopping history and last-generate', () => {
    expect(isPersistedKey(['shopping', 'history', 1])).toBe(false);
    expect(isPersistedKey(['shopping', 'last-generate'])).toBe(false);
  });
  it('denies unknown and empty keys', () => {
    expect(isPersistedKey(['budget', 'summary'])).toBe(false);
    expect(isPersistedKey([])).toBe(false);
  });
});

describe('keyHash', () => {
  it('is stable across object key order', () => {
    expect(keyHash(['a', { x: 1, y: 2 }])).toBe(keyHash(['a', { y: 2, x: 1 }]));
  });
  it('differs for different keys', () => {
    expect(keyHash(['a'])).not.toBe(keyHash(['b']));
  });
});
