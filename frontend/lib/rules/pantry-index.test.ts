import { describe, expect, it } from 'vitest';
import type { RulesPantryItem } from './types';
import { MAX_PANTRY_ITEMS, buildPantryIndex, pantryHas } from './pantry-index';

const TODAY = '2026-10-10';
const item = (
  ingredientName: string,
  quantity: number | string,
  unit: string,
  expiryDate: string | null = null,
  id = ingredientName + quantity + unit,
): RulesPantryItem => ({ id, ingredientName, quantity: quantity as number, unit, expiryDate });

describe('buildPantryIndex', () => {
  it('sums mass across units', () => {
    const idx = buildPantryIndex([item('Flour', 500, 'g'), item('flour', 1, 'kg', null, 'b')], TODAY);
    expect(idx.entries.get('flour')?.baseByFamily.get('mass')).toBeCloseTo(1500, 6);
  });

  it('sums volume across units', () => {
    const idx = buildPantryIndex([item('milk', 2, 'cups'), item('milk', 250, 'ml', null, 'b')], TODAY);
    expect(idx.entries.get('milk')?.baseByFamily.get('volume')).toBeCloseTo(723.176473, 5);
  });

  it('keeps count units separate per unitKey', () => {
    const idx = buildPantryIndex(
      [item('garlic', 2, 'pieces'), item('garlic', 3, 'cloves', null, 'b')],
      TODAY,
    );
    const fam = idx.entries.get('garlic')?.baseByFamily;
    expect(fam?.get('count:pieces')).toBe(2);
    expect(fam?.get('count:clove')).toBe(3);
  });

  it('excludes expired lots and invalid quantities', () => {
    const idx = buildPantryIndex(
      [
        item('milk', 1, 'l', '2026-10-09'),
        item('egg', 0, 'pieces'),
        item('rice', -1, 'kg'),
        item('oats', NaN, 'kg'),
        item('corn', 'abc', 'kg'),
      ],
      TODAY,
    );
    expect(idx.entries.size).toBe(0);
  });

  it('coerces numeric strings', () => {
    const idx = buildPantryIndex([item('rice', '2', 'kg')], TODAY);
    expect(idx.entries.get('rice')?.baseByFamily.get('mass')).toBe(2000);
  });

  it('tracks minimum non-negative days left', () => {
    const idx = buildPantryIndex(
      [
        item('milk', 1, 'l', '2026-10-15'),
        item('milk', 1, 'l', '2026-10-12', 'b'),
        item('milk', 1, 'l', '2026-10-09', 'c'),
        item('rice', 1, 'kg'),
      ],
      TODAY,
    );
    expect(idx.entries.get('milk')?.minDaysLeft).toBe(2);
    expect(idx.entries.get('rice')?.minDaysLeft).toBeNull();
  });

  it('does not mutate input and freezes output', () => {
    const input = [item('flour', 1, 'kg')];
    const snap = JSON.parse(JSON.stringify(input));
    const idx = buildPantryIndex(input, TODAY);
    expect(input).toEqual(snap);
    expect(Object.isFrozen(idx)).toBe(true);
    expect(Object.isFrozen(idx.entries.get('flour'))).toBe(true);
  });

  it('caps at MAX_PANTRY_ITEMS', () => {
    const many = Array.from({ length: MAX_PANTRY_ITEMS + 5 }, (_, i) => item(`thing${i}x`, 1, 'kg', null, `id${i}`));
    const idx = buildPantryIndex(many, TODAY);
    expect(idx.capped).toBe(true);
    expect(idx.entries.size).toBe(MAX_PANTRY_ITEMS);
  });

  it('pantryHas reflects stock', () => {
    const idx = buildPantryIndex([item('flour', 1, 'kg')], TODAY);
    expect(pantryHas(idx, 'flour')).toBe(true);
    expect(pantryHas(idx, 'sugar')).toBe(false);
  });
});
