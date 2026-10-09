import type { CoveredItem } from '@/types/shopping.types';

interface GenerateCounts {
  readonly added: number;
  readonly merged: number;
  readonly covered?: readonly CoveredItem[];
  readonly skippedStaples?: readonly string[];
}

const itemWord = (n: number): string => (n === 1 ? 'item' : 'items');

const nonEmpty = (list: readonly unknown[] | undefined): boolean =>
  Array.isArray(list) && list.length > 0;

/** Human-readable summary of a generate-from-meal-plan result. */
export function describeGenerateResult({
  added,
  merged,
  covered,
  skippedStaples,
}: GenerateCounts): string {
  const entries = Array.isArray(covered) ? covered : [];
  const coveredCount = entries.filter((c) => c.status !== 'on_list').length;
  const onListCount = entries.length - coveredCount;
  if (added > 0 && merged > 0) {
    return `${added} ${itemWord(added)} added, ${merged} merged into your list`;
  }
  if (added > 0) {
    const base = `${added} ${itemWord(added)} added to your list`;
    return coveredCount > 0 ? `${base} (${coveredCount} already in your pantry)` : base;
  }
  if (merged > 0) return `${merged} ${itemWord(merged)} merged into your list`;
  if (coveredCount > 0) return 'Your pantry already covers this plan';
  if (onListCount > 0) return 'Already on your list, nothing new to add';
  if (nonEmpty(skippedStaples)) return 'Only staples in this plan, nothing to add';
  return 'Your list already has everything from this plan';
}
