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
});
