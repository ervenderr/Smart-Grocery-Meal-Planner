import { describe, expect, it } from 'vitest';
import { describeGenerateResult } from './generate-summary';

describe('describeGenerateResult', () => {
  it('reports added and merged counts', () => {
    expect(describeGenerateResult({ added: 12, merged: 3 })).toBe(
      '12 items added, 3 merged into your list'
    );
  });
  it('handles a single added item', () => {
    expect(describeGenerateResult({ added: 1, merged: 0 })).toBe('1 item added to your list');
  });
  it('handles merged only', () => {
    expect(describeGenerateResult({ added: 0, merged: 2 })).toBe('2 items merged into your list');
    expect(describeGenerateResult({ added: 0, merged: 1 })).toBe('1 item merged into your list');
  });
  it('handles nothing changed', () => {
    expect(describeGenerateResult({ added: 0, merged: 0 })).toBe(
      'Your list already has everything from this plan'
    );
  });

  const full = {
    name: 'Rice',
    needed: 1,
    have: 2,
    unit: 'kg',
    status: 'full' as const,
  };

  it('says the pantry covers the plan when nothing was added', () => {
    expect(describeGenerateResult({ added: 0, merged: 0, covered: [full] })).toBe(
      'Your pantry already covers this plan'
    );
  });
  it('says only staples when nothing else applies', () => {
    expect(
      describeGenerateResult({ added: 0, merged: 0, covered: [], skippedStaples: ['Salt'] })
    ).toBe('Only staples in this plan, nothing to add');
  });
  it('mentions pantry-covered count when items were added', () => {
    expect(describeGenerateResult({ added: 2, merged: 0, covered: [full, full] })).toBe(
      '2 items added to your list (2 already in your pantry)'
    );
  });
});
