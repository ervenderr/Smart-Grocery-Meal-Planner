import { describe, expect, it } from 'vitest';
import {
  NON_RETRYABLE_FALLBACK_COPY,
  RETRYABLE_ERROR_COPY,
  classifyOnboardingError,
  findAlreadyCreated,
} from './errors';

const httpError = (status: number, data?: unknown) => ({ response: { status, data } });

describe('classifyOnboardingError', () => {
  it('treats missing responses (network, timeout) as retryable', () => {
    expect(classifyOnboardingError(new Error('Network Error'))).toEqual({
      retryable: true,
      message: RETRYABLE_ERROR_COPY,
    });
    expect(classifyOnboardingError({ request: {} }).retryable).toBe(true);
    expect(classifyOnboardingError(undefined).retryable).toBe(true);
  });

  it.each([500, 502, 503, 408, 429])('treats %i as retryable', (status) => {
    const result = classifyOnboardingError(httpError(status, { message: 'x' }));
    expect(result.retryable).toBe(true);
    expect(result.message).toBe(RETRYABLE_ERROR_COPY);
  });

  it.each([400, 404, 409, 422])('treats %i as non-retryable with the server message', (status) => {
    const result = classifyOnboardingError(httpError(status, { message: 'Budget too large' }));
    expect(result).toEqual({ retryable: false, message: 'Budget too large' });
  });

  it('falls back to generic copy when a 4xx has no body message', () => {
    expect(classifyOnboardingError(httpError(400)).message).toBe(NON_RETRYABLE_FALLBACK_COPY);
  });
});

describe('findAlreadyCreated', () => {
  it('matches existing items case-insensitively', () => {
    const existing = [{ ingredientName: 'rice' }, { ingredientName: ' Eggs ' }];
    expect(findAlreadyCreated(['Rice', 'eggs', 'Milk'], existing)).toEqual(['Rice', 'eggs']);
  });

  it('returns an empty list when nothing exists', () => {
    expect(findAlreadyCreated(['Rice'], [])).toEqual([]);
  });
});
