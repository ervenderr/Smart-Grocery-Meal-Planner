import { describe, expect, it } from 'vitest';
import { scaleIngredients } from './scale';
import type { RecipeIngredient } from '@/types/recipe.types';

const base: readonly RecipeIngredient[] = Object.freeze([
  { ingredientName: 'flour', quantity: 2, unit: 'cups' },
  { ingredientName: 'salt', quantity: 0.75, unit: 'tsp', notes: 'fine' },
] as RecipeIngredient[]);

describe('scaleIngredients', () => {
  it('doubles quantities when servings double', () => {
    const out = scaleIngredients(base, 4, 8);
    expect(out.map((i) => i.quantity)).toEqual([4, 1.5]);
  });

  it('halves and rounds to 2 dp', () => {
    const out = scaleIngredients(base, 4, 2);
    expect(out.map((i) => i.quantity)).toEqual([1, 0.38]);
  });

  it('returns equal values in a new array for same servings', () => {
    const out = scaleIngredients(base, 4, 4);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
  });

  it('returns an unchanged copy when from is not positive', () => {
    const out = scaleIngredients(base, 0, 4);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
  });

  it('returns an unchanged copy when to is not positive', () => {
    expect(scaleIngredients(base, 4, 0)).toEqual(base);
    expect(scaleIngredients(base, 4, -1)).toEqual(base);
  });

  it('does not mutate input and keeps other fields', () => {
    const out = scaleIngredients(base, 4, 8);
    expect(base[0].quantity).toBe(2);
    expect(out[1].notes).toBe('fine');
    expect(out[0]).not.toBe(base[0]);
  });
});
