import { describe, expect, it } from 'vitest';
import { finishToast, pantryToggleHelper } from './finish-toast';
import type { FinishShoppingResult } from '@/types/shopping.types';

const base = {} as FinishShoppingResult;
const withPantry = (added: number, merged: number, failed = false): FinishShoppingResult => ({
  ...base,
  pantry: { added, merged, failed },
});

describe('finishToast', () => {
  it('formats added only (plural)', () => {
    expect(finishToast(withPantry(5, 0), true)).toEqual({
      kind: 'success',
      message: 'Shopping finished. 5 items added to your pantry.',
    });
  });
  it('formats added only (singular)', () => {
    expect(finishToast(withPantry(1, 0), true)?.message).toBe(
      'Shopping finished. 1 item added to your pantry.',
    );
  });
  it('formats added and merged', () => {
    expect(finishToast(withPantry(3, 2), true)?.message).toBe(
      'Shopping finished. 3 added to your pantry, 2 merged.',
    );
  });
  it('formats merged only', () => {
    expect(finishToast(withPantry(0, 2), true)?.message).toBe(
      'Shopping finished. 2 merged into your pantry.',
    );
  });
  it('formats nothing changed', () => {
    expect(finishToast(withPantry(0, 0), true)).toEqual({
      kind: 'success',
      message: 'Shopping finished. Your pantry is up to date.',
    });
  });
  it('reports failure as error', () => {
    expect(finishToast(withPantry(0, 0, true), true)).toEqual({
      kind: 'error',
      message:
        "Shopping finished, but we couldn't update your pantry. You can add the items manually.",
    });
  });
  it('returns null when off or pantry missing', () => {
    expect(finishToast(withPantry(2, 0), false)).toBeNull();
    expect(finishToast(base, true)).toBeNull();
  });
});

describe('pantryToggleHelper', () => {
  it('describes counts', () => {
    expect(pantryToggleHelper(4, true)).toBe('4 items will be added or merged into your pantry.');
    expect(pantryToggleHelper(1, true)).toBe('1 item will be added or merged into your pantry.');
    expect(pantryToggleHelper(4, false)).toBe("Your pantry won't change.");
    expect(pantryToggleHelper(0, true)).toBe('No checked items to add.');
    expect(pantryToggleHelper(0, false)).toBe('No checked items to add.');
  });
});
