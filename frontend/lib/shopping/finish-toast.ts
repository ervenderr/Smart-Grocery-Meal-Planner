import type { FinishShoppingResult } from '@/types/shopping.types';

export interface FinishToast {
  kind: 'success' | 'error';
  message: string;
}

const noun = (count: number) => (count === 1 ? 'item' : 'items');

/** Toast for a bought-it finish; null means keep the existing finish copy. */
export function finishToast(
  result: FinishShoppingResult,
  addToPantry: boolean,
): FinishToast | null {
  if (!addToPantry || !result.pantry) return null;
  const { added, merged, failed } = result.pantry;

  if (failed) {
    return {
      kind: 'error',
      message:
        "Shopping finished, but we couldn't update your pantry. You can add the items manually.",
    };
  }

  let message: string;
  if (added > 0 && merged > 0) {
    message = `Shopping finished. ${added} added to your pantry, ${merged} merged.`;
  } else if (added > 0) {
    message = `Shopping finished. ${added} ${noun(added)} added to your pantry.`;
  } else if (merged > 0) {
    message = `Shopping finished. ${merged} merged into your pantry.`;
  } else {
    message = 'Shopping finished. Your pantry is up to date.';
  }
  return { kind: 'success', message };
}

export function pantryToggleHelper(checkedCount: number, on: boolean): string {
  if (checkedCount === 0) return 'No checked items to add.';
  if (!on) return "Your pantry won't change.";
  return `${checkedCount} ${noun(checkedCount)} will be added or merged into your pantry.`;
}
