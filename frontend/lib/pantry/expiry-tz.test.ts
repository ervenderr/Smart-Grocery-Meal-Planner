import { afterAll, describe, expect, it } from 'vitest';
import { formatExpiryDate, getDaysUntilExpiry, getExpiryBadge } from './expiry';

const ZONES = ['America/Los_Angeles', 'Asia/Manila', 'Pacific/Kiritimati', 'UTC'];
const originalTz = process.env.TZ;

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe.each(ZONES)('expiry helpers in %s', (tz) => {
  const run = <T>(fn: () => T): T => {
    process.env.TZ = tz;
    return fn();
  };

  it('formats a date-only value as the same calendar date', () => {
    const out = run(() => formatExpiryDate('2026-10-11', 'en-US'));
    expect(out).toBe('10/11/2026');
    expect(run(() => formatExpiryDate('2026-10-11T00:00:00.000Z', 'en-US'))).toBe('10/11/2026');
  });

  it('returns empty string for invalid values', () => {
    expect(formatExpiryDate(null)).toBe('');
    expect(formatExpiryDate('2026-02-31')).toBe('');
  });

  it.each([
    ['2026-10-10', 0],
    ['2026-10-11', 1],
    ['2026-10-17', 7],
    ['2026-10-09', -1],
  ])('days left for %s is %i at any local time', (date, expected) => {
    for (const hour of [0, 12, 23]) {
      const days = run(() => getDaysUntilExpiry(date, new Date(2026, 9, 10, hour, 30)));
      expect(days).toBe(expected);
    }
  });

  it('builds badges from calendar days', () => {
    const now = () => new Date(2026, 9, 10, 23, 59);
    expect(run(() => getExpiryBadge('2026-10-11', now()))?.label).toBe('1 day left');
    expect(run(() => getExpiryBadge('2026-10-10', now()))?.label).toBe('Expires today');
    expect(run(() => getExpiryBadge('2026-10-09', now()))?.status).toBe('expired');
    expect(run(() => getExpiryBadge('2026-10-15', now()))?.status).toBe('warning');
    expect(run(() => getExpiryBadge('2026-12-01', now()))).toBeNull();
  });
});
