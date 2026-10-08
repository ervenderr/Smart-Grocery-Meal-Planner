import { describe, it, expect } from 'vitest';
import { getShoppingLoadState } from './load-state';

describe('getShoppingLoadState', () => {
  it('shows loading only while there is no data', () => {
    expect(getShoppingLoadState({ isLoading: true, isError: false, hasData: false })).toBe(
      'loading'
    );
  });

  it('shows the full-screen error when the first load fails', () => {
    expect(getShoppingLoadState({ isLoading: false, isError: true, hasData: false })).toBe(
      'error'
    );
  });

  it('keeps the cached list when a background refetch fails', () => {
    expect(getShoppingLoadState({ isLoading: false, isError: true, hasData: true })).toBe(
      'refresh-failed'
    );
  });

  it('is ready when data is present and nothing failed', () => {
    expect(getShoppingLoadState({ isLoading: false, isError: false, hasData: true })).toBe(
      'ready'
    );
  });
});
