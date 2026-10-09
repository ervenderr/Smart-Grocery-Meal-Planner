import { describe, expect, it } from 'vitest';
import { unitLabel } from './vocab';
import {
  buildGenerateNotes,
  formatCoveredLine,
  toLastGenerateResult,
  type LastGenerateResult,
} from './covered-note';
import type { CoveredItem, GenerateShoppingListResult } from '@/types/shopping.types';

const base = (over: Partial<LastGenerateResult> = {}): LastGenerateResult => ({
  mealPlanId: 'p1',
  added: 0,
  merged: 0,
  covered: [],
  skippedStaples: [],
  pantryCapped: false,
  ...over,
});

describe('formatCoveredLine', () => {
  it('formats a fully covered item', () => {
    const item: CoveredItem = { name: 'Rice', needed: 500, have: 1000, unit: 'grams', status: 'full' };
    const u = unitLabel('grams');
    expect(formatCoveredLine(item)).toBe(`Rice: have 1000 ${u}, need 500 ${u}`);
  });
  it('formats a partial item with decimals trimmed', () => {
    const item: CoveredItem = { name: 'Rolled oats', needed: 1, have: 0.4, unit: 'kg', status: 'partial' };
    const u = unitLabel('kg');
    expect(formatCoveredLine(item)).toBe(`Rolled oats: have 0.4 ${u}, need 1 ${u} (added the rest)`);
  });
  it('rounds to two decimals', () => {
    const item: CoveredItem = { name: 'Milk', needed: 1.5, have: 0.3333, unit: 'kg', status: 'partial' };
    const u = unitLabel('kg');
    expect(formatCoveredLine(item)).toBe(`Milk: have 0.33 ${u}, need 1.5 ${u} (added the rest)`);
  });
  it('formats an incompatible item', () => {
    const item: CoveredItem = {
      name: 'Milk', needed: 2, have: 1, unit: 'cups', status: 'incompatible', haveUnit: 'pieces',
    };
    expect(formatCoveredLine(item)).toBe(
      `Milk: can't compare units (have 1 ${unitLabel('pieces')}), added in full`
    );
  });
});

describe('toLastGenerateResult', () => {
  it('defaults missing fields', () => {
    const result = { list: {}, added: 1, merged: 2 } as unknown as GenerateShoppingListResult;
    expect(toLastGenerateResult('p1', result)).toEqual(base({ added: 1, merged: 2 }));
  });
  it('coerces invalid values', () => {
    const result = {
      list: {}, added: 0, merged: 0, covered: 'x', skippedStaples: 5, pantryCapped: 'yes',
    } as unknown as GenerateShoppingListResult;
    const last = toLastGenerateResult('p1', result);
    expect(last.covered).toEqual([]);
    expect(last.skippedStaples).toEqual([]);
    expect(last.pantryCapped).toBe(false);
  });
  it('keeps valid values', () => {
    const covered: CoveredItem[] = [{ name: 'Rice', needed: 1, have: 2, unit: 'kg', status: 'full' }];
    const result = {
      list: {}, added: 0, merged: 0, covered, skippedStaples: ['Salt'], pantryCapped: true,
    } as unknown as GenerateShoppingListResult;
    const last = toLastGenerateResult('p9', result);
    expect(last).toMatchObject({ mealPlanId: 'p9', covered, skippedStaples: ['Salt'], pantryCapped: true });
  });
});

describe('buildGenerateNotes', () => {
  it('handles null', () => {
    expect(buildGenerateNotes(null)).toEqual({
      coveredLines: [], skippedText: null, cappedText: null, hasNotes: false,
    });
  });
  it('joins skipped staples', () => {
    const n = buildGenerateNotes(base({ skippedStaples: ['Salt', 'Olive oil'] }));
    expect(n.skippedText).toBe('Salt, Olive oil');
    expect(n.hasNotes).toBe(true);
  });
  it('has notes when covered', () => {
    const covered: CoveredItem[] = [{ name: 'Rice', needed: 1, have: 2, unit: 'kg', status: 'full' }];
    const n = buildGenerateNotes(base({ covered }));
    expect(n.coveredLines).toHaveLength(1);
    expect(n.hasNotes).toBe(true);
  });
  it('shows the capped message alone', () => {
    const n = buildGenerateNotes(base({ pantryCapped: true }));
    expect(n.cappedText).toBe(
      'Your pantry is too large to fully compare; some items may already be in your pantry.'
    );
    expect(n.hasNotes).toBe(true);
  });
  it('does not mutate frozen input', () => {
    const covered = Object.freeze([
      Object.freeze({ name: 'Rice', needed: 1, have: 2, unit: 'kg', status: 'full' as const }),
    ]) as unknown as CoveredItem[];
    const input = Object.freeze(
      base({ covered, skippedStaples: Object.freeze(['Salt']) as unknown as string[] })
    );
    expect(() => buildGenerateNotes(input)).not.toThrow();
  });
});
