import { describe, it, expect } from 'vitest';
import {
  clampUse,
  leftFor,
  toDeductions,
  deductionCount,
  cookSuccessToast,
} from './preview';
import type { CookRow } from '@/types/cook.types';

const eggs: CookRow = { key: 'eggs', name: 'Eggs', unit: 'pieces', have: 12, use: 4, left: 8, status: 'ok' };
const milk: CookRow = { key: 'milk', name: 'Milk', unit: 'ml', have: 500, use: 0, left: 500, status: 'mismatch', recipeQuantity: 1, recipeUnit: 'cups' };

describe('clampUse', () => {
  it('accepts a value within stock', () => {
    expect(clampUse('200', 500)).toEqual({ value: 200, clamped: false, error: null });
  });
  it('clamps above stock', () => {
    expect(clampUse('600', 500)).toEqual({ value: 500, clamped: true, error: null });
  });
  it('rejects negatives', () => {
    expect(clampUse('-1', 5).error).toBe('negative');
  });
  it('rejects non-numbers', () => {
    expect(clampUse('abc', 5).error).toBe('invalid');
  });
  it('treats empty as zero', () => {
    expect(clampUse('', 5)).toEqual({ value: 0, clamped: false, error: null });
  });
});

describe('leftFor', () => {
  it('subtracts', () => {
    expect(leftFor(500, 200)).toBe(300);
    expect(leftFor(1, 0.25)).toBe(0.75);
  });
  it('avoids float drift', () => {
    expect(leftFor(0.3, 0.1)).toBe(0.2);
  });
  it('never goes below zero', () => {
    expect(leftFor(5, 9)).toBe(0);
  });
});

describe('toDeductions', () => {
  const rows = [eggs, milk];
  it('skips zero uses', () => {
    expect(toDeductions(rows, { eggs: 4, milk: 0 })).toEqual([{ key: 'eggs', unit: 'pieces', use: 4 }]);
  });
  it('includes edited rows', () => {
    expect(toDeductions(rows, { eggs: 4, milk: 0.2 })).toHaveLength(2);
  });
  it('uses the pantry unit for mismatch rows', () => {
    expect(toDeductions([milk], { milk: 1 })).toEqual([{ key: 'milk', unit: 'ml', use: 1 }]);
  });
});

describe('deductionCount', () => {
  it('counts rows with use > 0', () => {
    expect(deductionCount([eggs, milk], { eggs: 4, milk: 0 })).toBe(1);
    expect(deductionCount([eggs, milk], { eggs: 4, milk: 1 })).toBe(2);
  });
});

describe('cookSuccessToast', () => {
  it('formats plural', () => {
    expect(cookSuccessToast({ updated: 3, usedUp: 0, skipped: 0 })).toBe('Pantry updated. 3 items used.');
  });
  it('includes used up', () => {
    expect(cookSuccessToast({ updated: 3, usedUp: 1, skipped: 0 })).toBe('Pantry updated. 3 items used, 1 used up.');
  });
  it('formats singular', () => {
    expect(cookSuccessToast({ updated: 1, usedUp: 0, skipped: 0 })).toBe('Pantry updated. 1 item used.');
  });
});
