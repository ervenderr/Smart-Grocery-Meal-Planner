import type { UserPreferences } from '@/types/preferences.types';

export const MAX_STAPLES = 100;
export const MAX_STAPLE_LENGTH = 60;

export type AddStapleResult =
  | { ok: true; list: string[] }
  | { ok: false; message: string };

export function normalizeStapleInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function addStaple(list: readonly string[], raw: string): AddStapleResult {
  const name = normalizeStapleInput(raw);
  if (name.length === 0) return { ok: false, message: 'Type a staple first' };
  if (name.length > MAX_STAPLE_LENGTH) {
    return { ok: false, message: `Keep staples under ${MAX_STAPLE_LENGTH} characters` };
  }
  if (list.some((existing) => normalizeStapleInput(existing) === name)) {
    return { ok: false, message: 'That staple is already on your list' };
  }
  if (list.length >= MAX_STAPLES) {
    return { ok: false, message: `You can keep up to ${MAX_STAPLES} staples` };
  }
  return { ok: true, list: [...list, name] };
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
