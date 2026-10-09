import { describe, expect, it } from 'vitest';
import { formatPeriodLabel, formatPeriodRangeLabel, parsePeriodKey } from './period';

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

describe('parsePeriodKey', () => {
  it('parses ISO week keys to the Monday of that week', () => {
    expect(iso(parsePeriodKey('2026-W34')?.start)).toBe('2026-08-17');
    expect(parsePeriodKey('2026-W34')?.kind).toBe('week');
  });

  it('handles week 1 that starts in the previous calendar year', () => {
    // 2026-01-01 is a Thursday, so ISO week 1 starts Mon 2025-12-29.
    expect(iso(parsePeriodKey('2026-W01')?.start)).toBe('2025-12-29');
    // 2024-01-01 is a Monday.
    expect(iso(parsePeriodKey('2024-W01')?.start)).toBe('2024-01-01');
  });

  it('handles week 52 and a real week 53', () => {
    expect(iso(parsePeriodKey('2026-W52')?.start)).toBe('2026-12-21');
    expect(iso(parsePeriodKey('2026-W53')?.start)).toBe('2026-12-28');
    expect(iso(parsePeriodKey('2020-W53')?.start)).toBe('2020-12-28');
  });

  it('maps the backend calendar-year quirk (2027-W53 means 2026-W53)', () => {
    expect(iso(parsePeriodKey('2027-W53')?.start)).toBe('2026-12-28');
  });

  it('rejects week 53 when no such week exists and out-of-range weeks', () => {
    expect(parsePeriodKey('2025-W53')).toBeNull();
    expect(parsePeriodKey('2026-W00')).toBeNull();
    expect(parsePeriodKey('2026-W54')).toBeNull();
  });

  it('parses daily keys', () => {
    expect(iso(parsePeriodKey('2026-08-17')?.start)).toBe('2026-08-17');
    expect(parsePeriodKey('2026-08-17')?.kind).toBe('day');
    expect(iso(parsePeriodKey('2024-02-29')?.start)).toBe('2024-02-29');
  });

  it('parses monthly keys', () => {
    expect(iso(parsePeriodKey('2026-08')?.start)).toBe('2026-08-01');
    expect(parsePeriodKey('2026-08')?.kind).toBe('month');
    expect(iso(parsePeriodKey('2026-12')?.start)).toBe('2026-12-01');
  });

  it('parses full ISO timestamps', () => {
    expect(iso(parsePeriodKey('2026-08-17T10:00:00.000Z')?.start)).toBe('2026-08-17');
  });

  it('returns null for bad input and never throws', () => {
    for (const bad of ['', 'abc', '2026-13', '2026-02-30', '2025-02-29', '2026-W', null, undefined, 42, {}, [], NaN]) {
      expect(() => parsePeriodKey(bad)).not.toThrow();
      expect(parsePeriodKey(bad)).toBeNull();
    }
  });
});

describe('formatPeriodLabel', () => {
  it('formats each period type', () => {
    expect(formatPeriodLabel('2026-W34')).toBe('Aug 17');
    expect(formatPeriodLabel('2026-08-05')).toBe('Aug 5');
    expect(formatPeriodLabel('2026-08')).toBe('Aug 2026');
  });

  it('crosses the year boundary', () => {
    expect(formatPeriodLabel('2026-W01')).toBe('Dec 29');
  });

  it('returns a safe placeholder for invalid input', () => {
    expect(formatPeriodLabel('nonsense')).toBe('—');
    expect(formatPeriodLabel(undefined)).toBe('—');
  });
});

describe('formatPeriodRangeLabel', () => {
  it('shows week ranges, including across months and years', () => {
    expect(formatPeriodRangeLabel('2026-W34')).toBe('Aug 17 - 23');
    expect(formatPeriodRangeLabel('2026-W36')).toBe('Aug 31 - Sep 6');
    expect(formatPeriodRangeLabel('2026-W01')).toBe('Dec 29 - Jan 4');
  });

  it('falls back to the short label for non-week keys and invalid input', () => {
    expect(formatPeriodRangeLabel('2026-08')).toBe('Aug 2026');
    expect(formatPeriodRangeLabel('bad')).toBe('—');
  });
});
