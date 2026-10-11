import { queryKeys } from '@/lib/react-query';
import { PREFERENCES_QUERY_KEY } from '@/lib/hooks/use-preferences';

export const PANTRY_ALL_KEY = ['pantry', 'list', 'all'] as const;
export const RECIPES_ALL_KEY = ['recipes', 'list', 'all'] as const;
export const MEAL_PLANS_ALL_KEY = ['mealPlans', 'list', 'all'] as const;
export const SHOPPING_ACTIVE_KEY = queryKeys.shopping.active();
export const PREFERENCES_KEY = PREFERENCES_QUERY_KEY;

const PERSISTED_ROOTS = new Set([
  'pantry',
  'recipes',
  'mealPlans',
  'preferences',
  'notifications',
  'analytics',
]);
const DENIED_SEGMENTS = new Set(['ai', 'preview', 'history', 'last-generate']);

export function isPersistedKey(key: readonly unknown[]): boolean {
  if (key.length === 0) return false;
  const [root, second] = key;
  if (key.some((seg) => typeof seg === 'string' && DENIED_SEGMENTS.has(seg))) return false;
  if (root === 'shopping') return second === 'active';
  if (root === 'notifications') return second === 'stats';
  return typeof root === 'string' && PERSISTED_ROOTS.has(root);
}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
};

export function keyHash(key: readonly unknown[]): string {
  return JSON.stringify(stable(key));
}
