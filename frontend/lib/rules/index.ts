/** Public API of the offline rules engine. Everything exported is JSON-serializable data or pure functions. */

export {
  rankRecipes,
  URGENCY_WEIGHTS,
  EXPIRY_WINDOW_DAYS,
  EXPIRY_POINTS,
  MISSING_PENALTY,
  MAX_RECIPES,
} from './rank';
export { findSubstitutes, hasSubstitute, matchSubstitutionKey } from './substitutions';
export { buildPantryIndex, pantryHas } from './pantry-index';
export { resolveStapleSet, DEFAULT_STAPLE_NAMES } from './staples-default';
export { formatAmount, unitLabel } from './format-amount';
export type * from './types';
