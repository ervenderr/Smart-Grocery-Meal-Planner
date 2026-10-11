import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';
import { refreshAfterCook } from './cook-ops';

// WR-13: a queued cook must not refetch the pantry (that would replace the folded optimistic view).
describe('refreshAfterCook', () => {
  it('invalidates the pantry after a direct (server-confirmed) cook', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    refreshAfterCook(qc, { updated: 1 });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.pantry.all });
  });

  it('does nothing when the cook was queued (null result)', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    refreshAfterCook(qc, null);
    expect(spy).not.toHaveBeenCalled();
  });
});
