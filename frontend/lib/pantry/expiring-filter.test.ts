import { describe, expect, it } from 'vitest';
import { filterExpiring } from './expiring-filter';

const NOW = new Date(2026, 9, 11, 12, 0, 0);

describe('filterExpiring', () => {
  it('keeps items expiring today through 7 days out', () => {
    const items = [
      { id: 'a', expiryDate: '2026-10-11' },
      { id: 'b', expiryDate: '2026-10-18' },
    ];
    expect(filterExpiring(items, NOW).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('excludes expired items and items beyond 7 days', () => {
    const items = [
      { id: 'old', expiryDate: '2026-10-10' },
      { id: 'far', expiryDate: '2026-10-19' },
    ];
    expect(filterExpiring(items, NOW)).toEqual([]);
  });

  it('excludes null, undefined and invalid dates', () => {
    const items = [
      { id: 'n', expiryDate: null },
      { id: 'u' },
      { id: 'bad', expiryDate: 'not-a-date' },
      { id: 'nonexistent', expiryDate: '2026-02-31' },
    ];
    expect(filterExpiring(items, NOW)).toEqual([]);
  });

  it('preserves input order', () => {
    const items = [
      { id: 'late', expiryDate: '2026-10-15' },
      { id: 'soon', expiryDate: '2026-10-12' },
    ];
    expect(filterExpiring(items, NOW).map((i) => i.id)).toEqual(['late', 'soon']);
  });

  it('does not mutate the input and returns a new array', () => {
    const items = [{ id: 'a', expiryDate: '2026-10-12' }];
    const snapshot = JSON.stringify(items);
    const result = filterExpiring(items, NOW);
    expect(result).not.toBe(items);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
