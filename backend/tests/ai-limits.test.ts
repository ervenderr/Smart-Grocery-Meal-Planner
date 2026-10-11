/**
 * Pure AI limit resolution and UTC month helpers.
 */

import {
  AiLimitConfig,
  nextUtcMonthStart,
  resolveUserLimits,
  utcMonthStart,
} from '../src/modules/ai/ai-limits';

const cfg: AiLimitConfig = {
  userDaily: 20,
  globalDaily: 100,
  paidUserDaily: 40,
  freeMonthly: 0,
  paidMonthly: 600,
};

describe('resolveUserLimits', () => {
  it('keeps free limits unchanged with the monthly cap disabled', () => {
    expect(resolveUserLimits(false, cfg)).toEqual({
      userDaily: 20,
      userMonthly: null,
      globalDaily: 100,
    });
  });

  it('gives entitled users the paid daily and monthly allowance', () => {
    expect(resolveUserLimits(true, cfg)).toEqual({
      userDaily: 40,
      userMonthly: 600,
      globalDaily: 100,
    });
  });

  it('applies a configured free monthly cap', () => {
    expect(resolveUserLimits(false, { ...cfg, freeMonthly: 100 }).userMonthly).toBe(100);
  });

  it('treats a paid monthly of 0 as disabled', () => {
    expect(resolveUserLimits(true, { ...cfg, paidMonthly: 0 }).userMonthly).toBeNull();
  });
});

describe('UTC month helpers', () => {
  it('utcMonthStart uses the UTC month', () => {
    expect(utcMonthStart(new Date('2026-10-31T23:59:00Z'))).toBe('2026-10-01');
    expect(utcMonthStart(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });

  it('nextUtcMonthStart rolls over the year', () => {
    expect(nextUtcMonthStart(new Date('2026-12-15T10:00:00Z'))).toBe('2027-01-01T00:00:00.000Z');
    expect(nextUtcMonthStart(new Date('2026-10-31T23:59:00Z'))).toBe('2026-11-01T00:00:00.000Z');
  });
});
