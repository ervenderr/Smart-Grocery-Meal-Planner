import { describe, expect, it } from 'vitest';
import { cookPageItems, isCookPage, mapCookPage, toCookPage } from './cook-page';

const freeze = <T>(v: T): T => Object.freeze(v);

describe('cook-page', () => {
  it('wraps a list in the { items, capped } shape the cook hook reads', () => {
    expect(toCookPage([1, 2], 5)).toEqual({ items: [1, 2], capped: false });
  });
  it('caps long lists and flags them as capped', () => {
    expect(toCookPage([1, 2, 3], 2)).toEqual({ items: [1, 2], capped: true });
  });
  it('recognizes only the page shape', () => {
    expect(isCookPage({ items: [], capped: false })).toBe(true);
    expect(isCookPage([])).toBe(false);
    expect(isCookPage({ items: 'x', capped: false })).toBe(false);
    expect(isCookPage(null)).toBe(false);
  });
  it('reads items from a page or a legacy persisted array', () => {
    expect(cookPageItems({ items: [1], capped: false })).toEqual([1]);
    expect(cookPageItems([2])).toEqual([2]);
    expect(cookPageItems(undefined)).toBeUndefined();
    expect(cookPageItems({ foo: 1 })).toBeUndefined();
  });
  it('maps page items without mutating the original', () => {
    const page = freeze({ items: freeze([1, 2]), capped: true });
    const out = mapCookPage(page, (xs: readonly number[]) => xs.map((x) => x * 10));
    expect(out).toEqual({ items: [10, 20], capped: true });
    expect(page.items).toEqual([1, 2]);
  });
  it('heals a legacy array into the page shape', () => {
    expect(mapCookPage([1], (xs: readonly number[]) => [...xs, 2])).toEqual({ items: [1, 2], capped: false });
  });
  it('passes through unknown or empty data', () => {
    const odd = { foo: 1 };
    expect(mapCookPage(odd, (xs: readonly number[]) => [...xs])).toBe(odd);
    expect(mapCookPage(undefined, (xs: readonly number[]) => [...xs])).toBeUndefined();
  });
});
