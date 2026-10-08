import { describe, expect, it } from 'vitest';
import {
  MAX_MEALS_PER_DAY,
  PREFERRED_UNITS,
  PREFERRED_UNIT_OPTIONS,
  normalizePreferredUnit,
} from './units';

describe('normalizePreferredUnit', () => {
  it.each(['kg', 'lb', 'g', 'oz'])('preserves stored unit %s', (unit) => {
    expect(normalizePreferredUnit(unit)).toBe(unit);
  });

  it('falls back to kg for unknown, empty or missing values', () => {
    expect(normalizePreferredUnit('stone')).toBe('kg');
    expect(normalizePreferredUnit('')).toBe('kg');
    expect(normalizePreferredUnit(undefined)).toBe('kg');
    expect(normalizePreferredUnit(null)).toBe('kg');
  });

  it('offers an option for every allowed unit', () => {
    expect(PREFERRED_UNIT_OPTIONS.map((o) => o.value)).toEqual([...PREFERRED_UNITS]);
  });

  it('matches the backend meals-per-day ceiling', () => {
    expect(MAX_MEALS_PER_DAY).toBe(5);
  });
});
