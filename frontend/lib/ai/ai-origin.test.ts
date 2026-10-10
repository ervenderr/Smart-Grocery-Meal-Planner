import { describe, expect, it } from 'vitest';
import { AI_GENERATED_TAG, isAiGeneratedRecipe } from './ai-origin';

describe('ai-origin', () => {
  it('exposes the tag constant', () => {
    expect(AI_GENERATED_TAG).toBe('AI Generated');
  });

  it('detects the AI tag', () => {
    expect(isAiGeneratedRecipe(['AI Generated'])).toBe(true);
  });

  it('is case-insensitive and trims', () => {
    expect(isAiGeneratedRecipe(['dinner', '  ai generated '])).toBe(true);
  });

  it('returns false for unrelated tags', () => {
    expect(isAiGeneratedRecipe(['dinner'])).toBe(false);
  });

  it('returns false for empty or undefined', () => {
    expect(isAiGeneratedRecipe([])).toBe(false);
    expect(isAiGeneratedRecipe(undefined)).toBe(false);
  });
});
