import {
  clampOccurredAt,
  utcDateOf,
  withinReceiptWindow,
} from '../src/modules/shopping/shopping.receipt-window';

const NOW = new Date('2026-10-10T15:30:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const dayOffset = (days: number): string =>
  new Date(Date.UTC(2026, 9, 10 + days)).toISOString().slice(0, 10);

describe('withinReceiptWindow', () => {
  it.each([0, -14, 1])('accepts offset %i days', (offset) => {
    expect(withinReceiptWindow(dayOffset(offset), NOW)).toBe(true);
  });

  it.each([-15, 2])('rejects offset %i days', (offset) => {
    expect(withinReceiptWindow(dayOffset(offset), NOW)).toBe(false);
  });

  it.each(['not-a-date', '2026-02-30', '', '2026-13-01'])('rejects %s', (value) => {
    expect(withinReceiptWindow(value, NOW)).toBe(false);
  });
});

describe('clampOccurredAt', () => {
  it('returns now when undefined', () => {
    expect(clampOccurredAt(undefined, NOW).getTime()).toBe(NOW.getTime());
  });

  it('clamps values older than 14 days to now - 14d', () => {
    const old = new Date(NOW.getTime() - 20 * DAY_MS).toISOString();
    expect(clampOccurredAt(old, NOW).getTime()).toBe(NOW.getTime() - 14 * DAY_MS);
  });

  it('clamps future values to now', () => {
    const future = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
    expect(clampOccurredAt(future, NOW).getTime()).toBe(NOW.getTime());
  });

  it('keeps in-range values', () => {
    const recent = new Date(NOW.getTime() - 3 * DAY_MS);
    expect(clampOccurredAt(recent.toISOString(), NOW).getTime()).toBe(recent.getTime());
  });

  it('returns a new Date and does not mutate the input', () => {
    const result = clampOccurredAt(undefined, NOW);
    expect(result).not.toBe(NOW);
    expect(NOW.toISOString()).toBe('2026-10-10T15:30:00.000Z');
  });

  it('falls back to now for an unparseable value', () => {
    expect(clampOccurredAt('garbage', NOW).getTime()).toBe(NOW.getTime());
  });
});

describe('utcDateOf', () => {
  it('returns UTC midnight', () => {
    expect(utcDateOf(NOW).toISOString()).toBe('2026-10-10T00:00:00.000Z');
  });
});
