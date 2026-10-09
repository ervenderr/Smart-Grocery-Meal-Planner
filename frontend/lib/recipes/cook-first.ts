import type { Recipe } from '@/types/recipe.types';

export interface ExpiringUse {
  name: string;
  daysLeft: number;
}

export interface CookFirstEntry {
  recipe: Recipe;
  score: number;
  usesExpiring: ExpiringUse[];
  coveragePercent: number;
}

export interface CookFirstResult {
  items: CookFirstEntry[];
  expiringCount: number;
}

export const COOK_FIRST_QUERY_KEY = (today: string, limit: number, includeAll: boolean) =>
  ['recipes', 'cook-first', today, limit, includeAll] as const;

const pad = (n: number): string => String(n).padStart(2, '0');

/** YYYY-MM-DD from the viewer's local calendar date. */
export function localDateString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUses(raw: unknown): ExpiringUse[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((u) => {
    if (!isRecord(u)) return [];
    const { name, daysLeft } = u;
    if (typeof name !== 'string' || !name) return [];
    if (typeof daysLeft !== 'number' || !Number.isInteger(daysLeft) || daysLeft < 0) return [];
    return [{ name, daysLeft }];
  });
}

function normalizeEntry(raw: unknown): CookFirstEntry[] {
  if (!isRecord(raw) || !isRecord(raw.recipe)) return [];
  const { id, name } = raw.recipe;
  if (typeof id !== 'string' || !id || typeof name !== 'string' || !name) return [];
  const coverage =
    typeof raw.coveragePercent === 'number' && Number.isFinite(raw.coveragePercent)
      ? Math.min(100, Math.max(0, raw.coveragePercent))
      : 0;
  const score = typeof raw.score === 'number' && Number.isFinite(raw.score) ? raw.score : 0;
  return [
    {
      recipe: raw.recipe as unknown as Recipe,
      score,
      usesExpiring: normalizeUses(raw.usesExpiring),
      coveragePercent: coverage,
    },
  ];
}

export function normalizeCookFirst(raw: unknown): CookFirstResult {
  if (!isRecord(raw)) return { items: [], expiringCount: 0 };
  const items = Array.isArray(raw.items) ? raw.items.flatMap(normalizeEntry) : [];
  const count = raw.expiringCount;
  const expiringCount =
    typeof count === 'number' && Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
  return { items, expiringCount };
}

function daysPhrase(daysLeft: number): string {
  if (daysLeft === 0) return 'expires today';
  return daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
}

export function expiringBadge(entry: CookFirstEntry): string | null {
  if (entry.usesExpiring.length === 0) return null;
  const sorted = [...entry.usesExpiring].sort((a, b) => a.daysLeft - b.daysLeft);
  const first = sorted[0];
  if (sorted.length === 1) return `Uses ${first.name} (${daysPhrase(first.daysLeft)})`;
  return `Uses ${first.name} + ${sorted.length - 1} more expiring`;
}

export function filterCookFirstEntries(
  entries: CookFirstEntry[],
  filters: { search?: string; category?: string; difficulty?: string }
): CookFirstEntry[] {
  const term = filters.search?.trim().toLowerCase();
  return entries.filter(({ recipe }) => {
    if (term && !recipe.name.toLowerCase().includes(term)) return false;
    if (filters.category && recipe.category !== filters.category) return false;
    if (filters.difficulty && recipe.difficulty !== filters.difficulty) return false;
    return true;
  });
}
