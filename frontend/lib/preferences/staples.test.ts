import { describe, expect, it } from 'vitest';
import type { UserPreferences } from '@/types/preferences.types';
import {
  MAX_STAPLES,
  MAX_STAPLE_LENGTH,
  addStaple,
  normalizeStapleInput,
  readStaples,
  removeStaple,
} from './staples';

const prefs = (extra: Partial<UserPreferences>): UserPreferences =>
  ({ id: '1', userId: 'u', ...extra }) as UserPreferences;

describe('normalizeStapleInput', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeStapleInput('  Olive   Oil ')).toBe('olive oil');
  });
});

describe('addStaple', () => {
  it('appends to a new array without mutating the input', () => {
    const list = Object.freeze(['salt']);
    const result = addStaple(list, 'Pepper');
    expect(result).toEqual({ ok: true, list: ['salt', 'pepper'] });
    expect(list).toEqual(['salt']);
  });

  it('rejects empty input', () => {
    expect(addStaple(['salt'], '  ')).toEqual({ ok: false, message: 'Type a staple first' });
  });

  it('rejects over-long input', () => {
    expect(addStaple([], 'a'.repeat(MAX_STAPLE_LENGTH + 1))).toEqual({
      ok: false,
      message: 'Keep staples under 60 characters',
    });
  });

  it('rejects duplicates case-insensitively', () => {
    expect(addStaple(['salt'], 'SALT')).toEqual({
      ok: false,
      message: 'That staple is already on your list',
    });
  });

  it('rejects when the list is full', () => {
    const full = Array.from({ length: MAX_STAPLES }, (_, i) => `item ${i}`);
    expect(addStaple(full, 'extra')).toEqual({
      ok: false,
      message: 'You can keep up to 100 staples',
    });
  });
});

describe('removeStaple', () => {
  it('removes a name without mutating', () => {
    const list = Object.freeze(['salt', 'pepper']);
    expect(removeStaple(list, 'salt')).toEqual(['pepper']);
    expect(list).toEqual(['salt', 'pepper']);
  });

  it('returns an equal new array when the name is missing', () => {
    const list = ['salt'];
    const out = removeStaple(list, 'nope');
    expect(out).toEqual(['salt']);
    expect(out).not.toBe(list);
  });
});

describe('readStaples', () => {
  it('returns null for missing prefs or an older backend', () => {
    expect(readStaples(undefined)).toBeNull();
    expect(readStaples(prefs({}))).toBeNull();
  });

  it('returns staples and defaults', () => {
    expect(
      readStaples(prefs({ stapleNames: ['salt'], defaultStapleNames: ['salt', 'pepper'] })),
    ).toEqual({ staples: ['salt'], defaults: ['salt', 'pepper'] });
  });

  it('returns null defaults when missing and filters non-strings', () => {
    const p = prefs({ stapleNames: ['salt', 5 as unknown as string] });
    expect(readStaples(p)).toEqual({ staples: ['salt'], defaults: null });
  });
});
