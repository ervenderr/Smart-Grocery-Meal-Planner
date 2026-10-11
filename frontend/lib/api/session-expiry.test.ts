import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
let native = true;

vi.mock('@/lib/platform/native', () => ({ isNative: () => native }));
vi.mock('@/lib/platform/navigation', () => ({ navigate: (...a: unknown[]) => navigate(...a) }));
vi.mock('@/lib/api/token-storage', () => ({ clearTokens: vi.fn(), setTokens: vi.fn() }));

import { useAuthStore } from '@/lib/stores/auth-store';
import { expireSession } from './session-expiry';

describe('expireSession', () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.stubGlobal('window', { location: { href: '' } });
    native = true;
    useAuthStore.setState({
      token: 'tok',
      user: { id: 'u1' } as never,
      isAuthenticated: true,
    });
  });

  it('flips the auth store to signed out', () => {
    expireSession();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('navigates to /login/ on native', () => {
    expireSession();
    expect(navigate).toHaveBeenCalledWith('/login/', { replace: true });
  });
});
