import { describe, expect, it } from 'vitest';
import {
  formatExpiryLabel,
  getDaysUntilExpiry,
  getExpiryStatus,
  toExpiringItems,
} from './expiry';

// Local-time constructor: 2026-03-10 at 23:30 local, then 00:15 local.
const lateTonight = new Date(2026, 2, 10, 23, 30, 0);
const justAfterMidnight = new Date(2026, 2, 10, 0, 15, 0);

describe('getDaysUntilExpiry', () => {
  it('returns null for null, undefined and empty values', () => {
    expect(getDaysUntilExpiry(null, lateTonight)).toBeNull();
    expect(getDaysUntilExpiry(undefined, lateTonight)).toBeNull();
    expect(getDaysUntilExpiry('', lateTonight)).toBeNull();
  });

  it('returns null for invalid or non-existent dates', () => {
    expect(getDaysUntilExpiry('not-a-date', lateTonight)).toBeNull();
    expect(getDaysUntilExpiry('2026-02-30', lateTonight)).toBeNull();
    expect(getDaysUntilExpiry('2026-13-01', lateTonight)).toBeNull();
  });

  it('returns 0 for today regardless of time of day', () => {
    expect(getDaysUntilExpiry('2026-03-10', lateTonight)).toBe(0);
    expect(getDaysUntilExpiry('2026-03-10', justAfterMidnight)).toBe(0);
  });

  it('counts whole days into the future and the past', () => {
    expect(getDaysUntilExpiry('2026-03-11', lateTonight)).toBe(1);
    expect(getDaysUntilExpiry('2026-03-17', justAfterMidnight)).toBe(7);
    expect(getDaysUntilExpiry('2026-03-09', justAfterMidnight)).toBe(-1);
    expect(getDaysUntilExpiry('2025-03-10', justAfterMidnight)).toBe(-365);
  });

  it('accepts ISO timestamps by using only the calendar date', () => {
    expect(getDaysUntilExpiry('2026-03-12T00:00:00.000Z', lateTonight)).toBe(2);
  });

  it('is not affected by month, year or leap-day boundaries', () => {
    expect(getDaysUntilExpiry('2028-03-01', new Date(2028, 1, 28, 12))).toBe(2);
    expect(getDaysUntilExpiry('2027-01-01', new Date(2026, 11, 31, 23, 59))).toBe(1);
  });

  it('is DST safe across a spring-forward week', () => {
    expect(getDaysUntilExpiry('2026-03-15', new Date(2026, 2, 7, 12))).toBe(8);
  });
});

describe('getExpiryStatus', () => {
  it('maps day counts to statuses', () => {
    expect(getExpiryStatus(-1)).toBe('expired');
    expect(getExpiryStatus(0)).toBe('critical');
    expect(getExpiryStatus(2)).toBe('critical');
    expect(getExpiryStatus(3)).toBe('warning');
    expect(getExpiryStatus(7)).toBe('warning');
    expect(getExpiryStatus(8)).toBe('ok');
  });
});

describe('formatExpiryLabel', () => {
  it('formats expired, today and future labels', () => {
    expect(formatExpiryLabel(-3)).toBe('Expired');
    expect(formatExpiryLabel(0)).toBe('Today');
    expect(formatExpiryLabel(1)).toBe('1d left');
    expect(formatExpiryLabel(6)).toBe('6d left');
  });
});

describe('toExpiringItems', () => {
  // Shape copied from backend PantryService.formatItem (flat item).
  const flat = (id: string, name: string, expiryDate: string | null) => ({
    id,
    userId: 'u1',
    ingredientName: name,
    quantity: '2',
    unit: 'pieces',
    category: 'dairy',
    expiryDate,
    purchaseDate: null,
    location: 'fridge',
    notes: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    isExpired: false,
    daysUntilExpiry: 1,
  });

  it('wraps flat backend items with computed days and status, sorted soonest first', () => {
    const result = toExpiringItems(
      [flat('b', 'milk', '2026-03-14'), flat('a', 'eggs', '2026-03-11')],
      justAfterMidnight,
    );
    expect(result.map((r) => r.item.id)).toEqual(['a', 'b']);
    expect(result[0]).toMatchObject({ daysUntilExpiry: 1, status: 'critical' });
    expect(result[1]).toMatchObject({ daysUntilExpiry: 4, status: 'warning' });
  });

  it('drops items without a usable expiry date', () => {
    const result = toExpiringItems(
      [flat('a', 'x', null), flat('b', 'y', 'garbage'), flat('c', 'z', '2026-03-10')],
      justAfterMidnight,
    );
    expect(result.map((r) => r.item.id)).toEqual(['c']);
  });

  it('returns an empty array for non-array payloads and null entries', () => {
    expect(toExpiringItems(undefined, justAfterMidnight)).toEqual([]);
    expect(toExpiringItems(null, justAfterMidnight)).toEqual([]);
    expect(toExpiringItems({ items: [] }, justAfterMidnight)).toEqual([]);
    expect(toExpiringItems([null, 5, flat('c', 'z', '2026-03-10')], justAfterMidnight)).toHaveLength(1);
  });
});
