import { describe, expect, it } from 'vitest';
import { parseItemPriceInput, parseQuantityInput } from './item-input';

describe('parseItemPriceInput', () => {
  it('treats blank as clear', () => {
    expect(parseItemPriceInput('  ', 'PHP')).toEqual({ ok: true, cents: null });
  });
  it('parses valid prices', () => {
    expect(parseItemPriceInput('12.50', 'PHP')).toEqual({ ok: true, cents: 1250 });
    expect(parseItemPriceInput('1500', 'JPY')).toEqual({ ok: true, cents: 150000 });
  });
  it.each(['1e3', '0x1F', '-1', '12.345', 'abc'])('rejects %s', (v) => {
    const r = parseItemPriceInput(v, 'PHP');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0);
  });
  it('rejects fractions for JPY', () => {
    expect(parseItemPriceInput('15.5', 'JPY').ok).toBe(false);
  });
  it('rejects above the cap and accepts the cap', () => {
    expect(parseItemPriceInput('2000000.01', 'PHP').ok).toBe(false);
    expect(parseItemPriceInput('2000000', 'PHP')).toEqual({ ok: true, cents: 200_000_000 });
  });
});

describe('parseQuantityInput', () => {
  it('defaults blank to 1', () => {
    expect(parseQuantityInput('')).toEqual({ ok: true, quantity: 1 });
  });
  it('parses valid quantities', () => {
    expect(parseQuantityInput('1.5')).toEqual({ ok: true, quantity: 1.5 });
    expect(parseQuantityInput('99999')).toEqual({ ok: true, quantity: 99999 });
    expect(parseQuantityInput('0.01')).toEqual({ ok: true, quantity: 0.01 });
  });
  it.each(['0', '0.001', '100000', 'abc', '1e2', '-1', '1.234'])('rejects %s', (v) => {
    expect(parseQuantityInput(v).ok).toBe(false);
  });
});
