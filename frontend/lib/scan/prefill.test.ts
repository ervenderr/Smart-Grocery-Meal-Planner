import { describe, expect, it } from 'vitest';
import type { FoodProduct } from '@/lib/api/food';
import type { PantryItem } from '@/types/pantry.types';
import { parseProductQuantity, prefillFromOwnItem, prefillFromProduct } from './prefill';

describe('parseProductQuantity', () => {
  it.each([
    ['500 g', 500, 'grams'],
    ['1 L', 1, 'liters'],
    ['1.5kg', 1.5, 'kg'],
    ['330 ml', 330, 'ml'],
    ['6 pcs', 6, 'pieces'],
  ])('parses %s', (text, quantity, unit) => {
    expect(parseProductQuantity(text)).toEqual({ quantity, unit });
  });
  it('returns null for multipacks, null and free text', () => {
    expect(parseProductQuantity('12 x 330 ml')).toBeNull();
    expect(parseProductQuantity(null)).toBeNull();
    expect(parseProductQuantity('family size')).toBeNull();
  });
});

const product: FoodProduct = {
  barcode: '4800016644801',
  name: 'Peanut Butter',
  brand: 'Skippy',
  quantity: '340 g',
  imageUrl: null,
  suggestedCategory: 'condiments',
  nutritionPer100g: { energyKcal: null, protein: null, fat: null, carbs: null },
};

describe('prefillFromProduct', () => {
  it('maps product fields', () => {
    expect(prefillFromProduct(product, '4800016644801')).toEqual({
      ingredientName: 'Peanut Butter',
      notes: 'Skippy',
      category: 'condiments',
      quantity: 340,
      unit: 'grams',
      barcode: '4800016644801',
    });
  });
  it('falls back to 1 piece and omits notes without brand', () => {
    const result = prefillFromProduct({ ...product, brand: null, quantity: null }, '4800016644801');
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('pieces');
    expect(result.notes).toBeUndefined();
  });
});

describe('prefillFromOwnItem', () => {
  it('keeps name, category, unit, barcode; resets quantity and expiry', () => {
    const item = {
      id: '1',
      userId: 'u',
      ingredientName: 'Rice',
      category: 'grains',
      quantity: 5,
      unit: 'kg',
      expiryDate: '2026-12-01',
      barcode: '4800016644801',
      createdAt: '',
      updatedAt: '',
    } as PantryItem;
    const result = prefillFromOwnItem(item);
    expect(result).toEqual({
      ingredientName: 'Rice',
      category: 'grains',
      unit: 'kg',
      quantity: 1,
      barcode: '4800016644801',
    });
    expect(result.expiryDate).toBeUndefined();
  });
});
