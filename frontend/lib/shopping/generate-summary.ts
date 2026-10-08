interface GenerateCounts {
  readonly added: number;
  readonly merged: number;
}

const itemWord = (n: number): string => (n === 1 ? 'item' : 'items');

/** Human-readable summary of a generate-from-meal-plan result. */
export function describeGenerateResult({ added, merged }: GenerateCounts): string {
  if (added > 0 && merged > 0) {
    return `${added} ${itemWord(added)} added, ${merged} merged into your list`;
  }
  if (added > 0) return `${added} ${itemWord(added)} added to your list`;
  if (merged > 0) return `${merged} ${itemWord(merged)} merged into your list`;
  return 'Your list already has everything from this plan';
}
