import { describe, expect, it, vi } from 'vitest';
import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import type { PantryItem } from '@/types/pantry.types';
import { resolveBarcode } from './resolve-barcode';

const attribution: FoodAttribution = { name: 'OFF', url: 'u', license: 'l', note: 'n' };
const product = { barcode: '4800016644801', name: 'Milk' } as FoodProduct;
const own = { id: '1', ingredientName: 'Milk' } as PantryItem;

function apiError(code: string) {
  return { response: { data: { code } } };
}

describe('resolveBarcode', () => {
  it('returns own and skips lookup', async () => {
    const lookup = vi.fn();
    const r = await resolveBarcode('4800016644801', { findOwn: async () => own, lookup });
    expect(r).toEqual({ kind: 'own', barcode: '4800016644801', item: own });
    expect(lookup).not.toHaveBeenCalled();
  });
  it('returns found', async () => {
    const r = await resolveBarcode('4800016644801', {
      findOwn: async () => null,
      lookup: async () => ({ product, attribution }),
    });
    expect(r).toEqual({ kind: 'found', barcode: '4800016644801', product, attribution });
  });
  it('maps LOOKUP_NOT_FOUND to unknown', async () => {
    const r = await resolveBarcode('4800016644801', {
      findOwn: async () => null,
      lookup: async () => Promise.reject(apiError('LOOKUP_NOT_FOUND')),
    });
    expect(r).toEqual({ kind: 'unknown', barcode: '4800016644801' });
  });
  it('maps an empty product name to unknown', async () => {
    const r = await resolveBarcode('4800016644801', {
      findOwn: async () => null,
      lookup: async () => ({ product: { ...product, name: '  ' }, attribution }),
    });
    expect(r.kind).toBe('unknown');
  });
  it.each(['LOOKUP_THROTTLED', 'LOOKUP_UNAVAILABLE'])('maps %s to failed', async (code) => {
    const r = await resolveBarcode('4800016644801', {
      findOwn: async () => null,
      lookup: async () => Promise.reject(apiError(code)),
    });
    expect(r.kind).toBe('failed');
  });
  it('maps network errors to failed', async () => {
    const r = await resolveBarcode('4800016644801', {
      findOwn: async () => null,
      lookup: async () => Promise.reject(new Error('Network Error')),
    });
    expect(r.kind).toBe('failed');
  });
  it('does not block when findOwn rejects', async () => {
    const r = await resolveBarcode('4800016644801', {
      findOwn: async () => Promise.reject(new Error('boom')),
      lookup: async () => ({ product, attribution }),
    });
    expect(r.kind).toBe('found');
  });
});
