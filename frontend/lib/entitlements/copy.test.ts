import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_COPY } from './copy';

function allStrings(): string[] {
  return Object.values(ENTITLEMENT_COPY).flatMap((v) => {
    if (typeof v === 'string') return [v];
    if (Array.isArray(v)) return [...v];
    return typeof v === 'function' ? [v('X')] : [];
  });
}

describe('ENTITLEMENT_COPY', () => {
  it('never uses forbidden marketing words, the old brand or price digits', () => {
    for (const text of allStrings()) {
      expect(text).not.toMatch(/subscribe|trial|per month|each month|free forever|Kitcha/i);
      expect(text).not.toMatch(/\$\s?\d/);
    }
  });

  it('describes AI as a daily benefit, not a monthly one', () => {
    expect(ENTITLEMENT_COPY.benefits).toContain('More AI recipe ideas every day');
    expect(ENTITLEMENT_COPY.descFree).toContain('every day');
  });

  it('keeps the contract strings for claimed-elsewhere and the sheet CTA', () => {
    expect(ENTITLEMENT_COPY.claimedElsewhere).toBe(
      'This purchase is already linked to another Kumaun account. Sign in to that account to use it.'
    );
    expect(ENTITLEMENT_COPY.ctaSheet('₱499.00')).toBe('Unlock for ₱499.00');
  });
});
