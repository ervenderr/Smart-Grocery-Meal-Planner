/**
 * Pure helper: carry the cooked marker across a meal-plan rebuild (06-08).
 * Matches by (recipeId, dayOfWeek, mealType), consuming matches one-to-one.
 */

export interface PreviousMeal {
  readonly recipeId: string;
  readonly dayOfWeek: number;
  readonly mealType: string;
  readonly cookedAt: Date | null;
}

export interface NextMeal {
  readonly recipeId: string;
  readonly dayOfWeek: number;
  readonly mealType: string;
}

const tripleKey = (m: NextMeal): string => `${m.recipeId}\u0000${m.dayOfWeek}\u0000${m.mealType}`;

export function carryCookedAt(
  previous: readonly PreviousMeal[],
  next: readonly NextMeal[],
): (Date | null)[] {
  const pool = new Map<string, (Date | null)[]>();
  for (const prev of previous) {
    const key = tripleKey(prev);
    const bucket = pool.get(key) ?? [];
    // Cooked entries first so a cooked meal is never lost to an uncooked duplicate.
    pool.set(key, prev.cookedAt ? [prev.cookedAt, ...bucket] : [...bucket, prev.cookedAt]);
  }
  return next.map((meal) => {
    const bucket = pool.get(tripleKey(meal));
    if (!bucket || bucket.length === 0) return null;
    return bucket.shift() ?? null;
  });
}
