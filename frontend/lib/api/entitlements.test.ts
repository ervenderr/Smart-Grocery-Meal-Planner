import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const get = vi.fn();
vi.mock('./client', () => ({ apiClient: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) } }));

import { entitlementsApi, ENTITLEMENT_QUERY_KEY } from './entitlements';

describe('entitlementsApi', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
  });

  it('verify posts the JWS with the Idempotency-Key header', async () => {
    post.mockResolvedValue({ status: 'active' });
    const res = await entitlementsApi.verify('jws-1', 'key-1');
    expect(post).toHaveBeenCalledWith(
      '/api/v1/entitlements/verify',
      { signedTransaction: 'jws-1' },
      { headers: { 'Idempotency-Key': 'key-1' } }
    );
    expect(res).toEqual({ status: 'active' });
  });

  it('me reads /entitlements/me', async () => {
    get.mockResolvedValue({ status: 'none' });
    await entitlementsApi.me();
    expect(get).toHaveBeenCalledWith('/api/v1/entitlements/me');
  });

  it('exposes a stable query key', () => {
    expect(ENTITLEMENT_QUERY_KEY).toEqual(['entitlements', 'me']);
  });
});
