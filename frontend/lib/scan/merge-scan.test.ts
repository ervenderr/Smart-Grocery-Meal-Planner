import { describe, expect, it } from 'vitest';
import { isCameraAvailable, mergeScanIntoForm } from './merge-scan';

describe('mergeScanIntoForm', () => {
  it('keeps typed values and fills only blank fields', () => {
    const patch = mergeScanIntoForm(
      { ingredientName: 'My milk', category: '', quantity: Number.NaN, unit: '' },
      {
        ingredientName: 'Milk 1L',
        category: 'dairy',
        quantity: 1,
        unit: 'liters',
        barcode: '4800016644801',
      }
    );
    expect(patch).toEqual({
      category: 'dairy',
      quantity: 1,
      unit: 'liters',
      barcode: '4800016644801',
    });
  });
  it('always applies the scanned barcode', () => {
    expect(mergeScanIntoForm({ barcode: '11111111' }, { barcode: '22222222' })).toEqual({
      barcode: '22222222',
    });
  });
  it('fills a blank name', () => {
    expect(mergeScanIntoForm({ ingredientName: '  ' }, { ingredientName: 'Rice' })).toEqual({
      ingredientName: 'Rice',
    });
  });
  it('returns an empty patch for empty input and does not mutate', () => {
    const current = Object.freeze({ ingredientName: 'x' });
    expect(mergeScanIntoForm(current, {})).toEqual({});
  });
});

describe('mergeScanIntoForm defaults', () => {
  const incoming = { category: 'dairy', unit: 'liters', barcode: '4800016644801' } as const;

  it('replaces untouched default category and unit', () => {
    const patch = mergeScanIntoForm({ category: 'other', unit: 'pieces' }, incoming, {
      dirtyFields: new Set(),
    });
    expect(patch).toEqual({ category: 'dairy', unit: 'liters', barcode: '4800016644801' });
  });

  it('never overrides defaults the user edited', () => {
    const patch = mergeScanIntoForm({ category: 'other', unit: 'pieces' }, incoming, {
      dirtyFields: new Set(['category', 'unit']),
    });
    expect(patch).toEqual({ barcode: '4800016644801' });
  });

  it('never overrides non-default values', () => {
    const patch = mergeScanIntoForm({ category: 'fruit', unit: 'kg' }, incoming, {
      dirtyFields: new Set(),
    });
    expect(patch).toEqual({ barcode: '4800016644801' });
  });

  it('treats defaults as user choices when dirty info is absent', () => {
    expect(mergeScanIntoForm({ category: 'other', unit: 'pieces' }, incoming)).toEqual({
      barcode: '4800016644801',
    });
  });
});

describe('isCameraAvailable', () => {
  it('is false without mediaDevices', () => {
    expect(isCameraAvailable({ hasMediaDevices: false, failure: null })).toBe(false);
  });
  it('is true with devices and no failure', () => {
    expect(isCameraAvailable({ hasMediaDevices: true, failure: null })).toBe(true);
  });
  it('stays true after a transient busy failure', () => {
    expect(isCameraAvailable({ hasMediaDevices: true, failure: 'busy' })).toBe(true);
  });
  it('is false after denied or unavailable', () => {
    expect(isCameraAvailable({ hasMediaDevices: true, failure: 'denied' })).toBe(false);
    expect(isCameraAvailable({ hasMediaDevices: true, failure: 'unavailable' })).toBe(false);
  });
});
