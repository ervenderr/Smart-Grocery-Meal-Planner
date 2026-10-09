import { canonicalName } from './canonical';
import type { UserPreferences } from '@/types/preferences.types';

export const MAX_STAPLES = 100;
export const MAX_STAPLE_LENGTH = 60;

export type AddStapleResult =
  | { ok: true; list: string[] }
  | { ok: false; message: string };

export function normalizeStapleInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const NO_LETTERS_MESSAGE = 'Staples need at least one letter or number';

/**
 * Validates and canonicalizes with the same rule as the server, so the list
 * shown here equals what is stored. A comma separates staples
 * ("salt, pepper" adds two), so a single qualified name must be written
 * without a comma ("black pepper", not "pepper, black").
 */
export function addStaple(list: readonly string[], raw: string): AddStapleResult {
  const parts = raw.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { ok: false, message: raw.trim().length === 0 ? 'Type a staple first' : NO_LETTERS_MESSAGE };
  }
  if (parts.some((part) => part.length > MAX_STAPLE_LENGTH)) {
    return { ok: false, message: `Keep staples under ${MAX_STAPLE_LENGTH} characters` };
  }
  const names = parts.map((part) => canonicalName(part));
  if (names.some((name) => name === '')) return { ok: false, message: NO_LETTERS_MESSAGE };

  const known = new Set(list.map((existing) => canonicalName(existing)));
  const fresh: string[] = [];
  for (const name of names) {
    if (known.has(name) || fresh.includes(name)) continue;
    fresh.push(name);
  }
  if (fresh.length === 0) return { ok: false, message: 'That staple is already on your list' };
  if (list.length + fresh.length > MAX_STAPLES) {
    return { ok: false, message: `You can keep up to ${MAX_STAPLES} staples` };
  }
  return { ok: true, list: [...list, ...fresh] };
}

export function removeStaple(list: readonly string[], name: string): string[] {
  return list.filter((item) => item !== name);
}

function onlyStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function readStaples(
  prefs: UserPreferences | undefined,
): { staples: string[]; defaults: string[] | null } | null {
  if (!prefs || !Array.isArray(prefs.stapleNames)) return null;
  return {
    staples: onlyStrings(prefs.stapleNames),
    defaults: Array.isArray(prefs.defaultStapleNames)
      ? onlyStrings(prefs.defaultStapleNames)
      : null,
  };
}
