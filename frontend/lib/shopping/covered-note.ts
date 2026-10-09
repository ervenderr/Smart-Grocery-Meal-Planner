import type { CoveredItem, GenerateShoppingListResult } from '@/types/shopping.types';
import { unitLabel } from './vocab';

export interface LastGenerateResult {
  mealPlanId: string;
  added: number;
  merged: number;
  covered: CoveredItem[];
  skippedStaples: string[];
  pantryCapped: boolean;
}

export const PANTRY_CAPPED_TEXT =
  'Your pantry is too large to fully compare; some items may already be in your pantry.';

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Normalizes a generate response for caching; tolerates an older backend. */
export function toLastGenerateResult(
  mealPlanId: string,
  result: GenerateShoppingListResult
): LastGenerateResult {
  return {
    mealPlanId,
    added: result.added,
    merged: result.merged,
    covered: asArray<CoveredItem>(result.covered),
    skippedStaples: asArray<string>(result.skippedStaples),
    pantryCapped: result.pantryCapped === true,
  };
}

export const ON_LIST_TEXT = 'Already on your list';

const formatNumber = (n: number): string => String(Math.round(n * 100) / 100);

export function formatCoveredLine(item: CoveredItem): string {
  const unit = unitLabel(item.unit);
  if (item.status === 'incompatible') {
    const haveUnit = unitLabel(item.haveUnit ?? item.unit);
    return `${item.name}: can't compare units (have ${formatNumber(item.have)} ${haveUnit}), added in full`;
  }
  if (item.status === 'on_list') {
    return `${item.name}: ${ON_LIST_TEXT} (${formatNumber(item.have)} of ${formatNumber(item.needed)} ${unit})`;
  }
  const line = `${item.name}: have ${formatNumber(item.have)} ${unit}, need ${formatNumber(item.needed)} ${unit}`;
  return item.status === 'partial' ? `${line} (added the rest)` : line;
}

export function buildGenerateNotes(last: LastGenerateResult | null | undefined): {
  coveredLines: string[];
  skippedText: string | null;
  cappedText: string | null;
  hasNotes: boolean;
} {
  const coveredLines = (last?.covered ?? []).map(formatCoveredLine);
  const skipped = last?.skippedStaples ?? [];
  const skippedText = skipped.length > 0 ? skipped.join(', ') : null;
  const cappedText = last?.pantryCapped ? PANTRY_CAPPED_TEXT : null;
  return {
    coveredLines,
    skippedText,
    cappedText,
    hasNotes: coveredLines.length > 0 || skippedText !== null || cappedText !== null,
  };
}
