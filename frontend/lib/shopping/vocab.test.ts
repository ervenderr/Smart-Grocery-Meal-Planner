import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ORDER,
  SHOPPING_CATEGORIES,
  SHOPPING_UNITS,
  categoryLabel,
  isShoppingUnit,
  normalizeCategory,
  unitLabel,
} from './vocab';

describe('shopping vocab', () => {
  it('has the 11 backend categories with other last', () => {
    expect(SHOPPING_CATEGORIES.map((c) => c.value)).toEqual([
      'protein', 'vegetable', 'fruit', 'dairy', 'grains', 'spices',
      'canned', 'frozen', 'beverages', 'condiments', 'other',
    ]);
    expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe('other');
  });

  it('has the 12 backend units, pieces not pcs', () => {
    const values = SHOPPING_UNITS.map((u) => u.value);
    expect(values).toHaveLength(12);
    expect([...values].sort()).toEqual(
      ['lbs', 'kg', 'grams', 'oz', 'cups', 'ml', 'liters', 'tsp', 'tbsp', 'fl_oz', 'pieces', 'items'].sort()
    );
    expect(values).not.toContain('pcs');
  });

  it('normalizes categories', () => {
    expect(normalizeCategory('Dairy ')).toBe('dairy');
    expect(normalizeCategory('')).toBe('other');
    expect(normalizeCategory(null)).toBe('other');
    expect(normalizeCategory(undefined)).toBe('other');
    expect(normalizeCategory('produce')).toBe('other');
  });

  it('checks units and labels', () => {
    expect(isShoppingUnit('pieces')).toBe(true);
    expect(isShoppingUnit('pcs')).toBe(false);
    expect(unitLabel('fl_oz')).toBe('Fluid Ounces');
    expect(unitLabel('clove')).toBe('clove');
    expect(unitLabel('1/2 cup')).toBe('1/2 cup');
    expect(categoryLabel('canned')).toBe('Canned Goods');
  });
});
