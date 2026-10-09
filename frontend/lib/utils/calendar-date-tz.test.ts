import { afterAll, describe, expect, it } from 'vitest';
import {
  formatCalendarDate,
  inclusiveDayCount,
  parseCalendarDate,
  todayCalendarDate,
} from './calendar-date';

const ZONES = ['America/Los_Angeles', 'Asia/Manila', 'Pacific/Kiritimati', 'UTC'];
const originalTz = process.env.TZ;

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe.each(ZONES)('calendar-date helpers in %s', (tz) => {
  const run = <T>(fn: () => T): T => {
    process.env.TZ = tz;
    return fn();
  };
  const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

  it.each(['2026-10-05', '2026-10-05T00:00:00.000Z'])('formats %s as Oct 5', (value) => {
    expect(run(() => formatCalendarDate(value, short))).toBe('Oct 5');
  });

  it('formats long form with year', () => {
    const out = run(() =>
      formatCalendarDate('2026-10-11T00:00:00.000Z', { month: 'long', day: 'numeric', year: 'numeric' }),
    );
    expect(out).toBe('October 11, 2026');
  });

  it('counts a Mon-Sun plan as 7 days', () => {
    expect(
      run(() => inclusiveDayCount('2026-10-05T00:00:00.000Z', '2026-10-11T00:00:00.000Z')),
    ).toBe(7);
    expect(run(() => inclusiveDayCount('2026-10-05', '2026-10-05'))).toBe(1);
  });

  it('counts across a DST change correctly', () => {
    expect(run(() => inclusiveDayCount('2026-10-31', '2026-11-02'))).toBe(3);
  });

  it('uses the local date for today, not the UTC date', () => {
    expect(run(() => todayCalendarDate(new Date(2026, 9, 10, 23, 30)))).toBe('2026-10-10');
    expect(run(() => todayCalendarDate(new Date(2026, 9, 10, 0, 15)))).toBe('2026-10-10');
  });

  it('rejects invalid values', () => {
    expect(parseCalendarDate(null)).toBeNull();
    expect(parseCalendarDate('2026-02-31')).toBeNull();
    expect(formatCalendarDate('nope', short)).toBe('');
    expect(inclusiveDayCount('2026-10-05', undefined)).toBeNull();
  });
});
