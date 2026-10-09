import { readFileSync } from 'fs';
import { join } from 'path';
import { isoWeekKey, periodKey } from '../src/modules/analytics/iso-week';

const utc = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m - 1, d));

describe('isoWeekKey', () => {
  it.each([
    [[2024, 12, 30], '2025-W01'],
    [[2021, 1, 3], '2020-W53'],
    [[2026, 12, 31], '2026-W53'],
    [[2027, 1, 1], '2026-W53'],
    [[2020, 12, 31], '2020-W53'],
    [[2026, 1, 1], '2026-W01'],
    [[2024, 12, 29], '2024-W52'],
    [[2025, 12, 29], '2026-W01'],
  ])('%j -> %s', (ymd, expected) => {
    const [y, m, d] = ymd as number[];
    expect(isoWeekKey(utc(y, m, d))).toBe(expected);
  });
});

describe('periodKey', () => {
  it('daily uses UTC date', () => {
    expect(periodKey(new Date(Date.UTC(2026, 0, 5, 23, 30)), 'daily')).toBe('2026-01-05');
  });

  it('monthly uses UTC year-month', () => {
    expect(periodKey(utc(2026, 12, 31), 'monthly')).toBe('2026-12');
  });

  it('weekly delegates to isoWeekKey', () => {
    expect(periodKey(utc(2024, 12, 30), 'weekly')).toBe('2025-W01');
  });
});

describe('timezone independence', () => {
  it('module source uses no local getters', () => {
    const src = readFileSync(
      join(__dirname, '../src/modules/analytics/iso-week.ts'),
      'utf8'
    );
    for (const getter of ['getFullYear(', 'getMonth(', 'getDate(', 'getDay(']) {
      expect(src).not.toContain(getter);
    }
  });

  it('UTC-midnight input near year end gives the same key', () => {
    expect(isoWeekKey(utc(2024, 12, 31))).toBe('2025-W01');
    expect(periodKey(utc(2024, 12, 31), 'monthly')).toBe('2024-12');
  });
});
