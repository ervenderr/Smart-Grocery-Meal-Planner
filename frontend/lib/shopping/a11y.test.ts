import { describe, expect, it } from 'vitest';
import { itemCheckboxLabel, priceChipLabel } from './a11y';

describe('priceChipLabel', () => {
  it('starts with the visible chip text', () => {
    expect(priceChipLabel('Add price', 'Milk')).toBe('Add price for Milk');
    expect(priceChipLabel('$3.50', 'Milk').startsWith('$3.50')).toBe(true);
  });
});

describe('itemCheckboxLabel', () => {
  it('is the item name and never encodes checked state', () => {
    expect(itemCheckboxLabel('Milk')).toBe('Milk');
    expect(itemCheckboxLabel('Milk')).not.toMatch(/mark|bought|checked/i);
  });
});
