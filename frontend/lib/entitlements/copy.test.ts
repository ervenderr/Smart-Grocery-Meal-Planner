import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_COPY } from './copy';

function allStrings(): string[] {
  return Object.values(ENTITLEMENT_COPY).flatMap((v) => {
    if (typeof v === 'string') return [v];
    if (Array.isArray(v)) return [...v];
    return typeof v === 'function' ? [(v as (arg: string | number) => string)(7)] : [];
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

  it('uses the server-provided free limit instead of a hard-coded 25 (WR-05)', () => {
    expect(ENTITLEMENT_COPY.chipFree(40)).toBe('Free: 40 pantry items');
    expect(ENTITLEMENT_COPY.sheetLead(40)).toBe("You've used all 40 free pantry spots.");
    expect(ENTITLEMENT_COPY.webLimitInline(40)).toContain('(40 items)');
    expect(ENTITLEMENT_COPY.finishLimitWeb(40)).toContain('(40 items)');
    for (const v of Object.values(ENTITLEMENT_COPY)) {
      if (typeof v === 'string') expect(v).not.toMatch(/\b25\b/);
    }
  });
});
