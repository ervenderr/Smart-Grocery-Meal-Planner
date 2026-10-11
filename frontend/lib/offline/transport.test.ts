import { describe, it, expect, vi } from 'vitest';
import { createTransport, OUTBOX_REQUEST_TIMEOUT_MS, toFailure } from './transport';
import { OfflineError, isOfflineError, registerOfflineGate, isOfflineGateClosed } from '@/lib/api/offline-error';

function setup(overrides: Partial<Record<'post' | 'patch' | 'delete', unknown>> = {}, offline = false) {
  const client: Record<'post' | 'patch' | 'delete', ReturnType<typeof vi.fn>> = {
    post: vi.fn().mockResolvedValue({ ok: 1 }),
    patch: vi.fn().mockResolvedValue({ ok: 2 }),
    delete: vi.fn().mockResolvedValue({ ok: 3 }),
    ...(overrides as Record<string, ReturnType<typeof vi.fn>>),
  };
  const onNetworkFailure = vi.fn();
  const onSuccess = vi.fn();
  const t = createTransport({
    client: client as never,
    isOffline: () => offline,
    onNetworkFailure,
    onSuccess,
  });
  return { t, client, onNetworkFailure, onSuccess };
}

describe('transport', () => {
  it('timeout constant is 8000', () => {
    expect(OUTBOX_REQUEST_TIMEOUT_MS).toBe(8000);
  });
  it('POST sends idempotency key and timeout', async () => {
    const { t, client, onSuccess } = setup();
    const r = await t.send({ method: 'POST', url: '/x', body: { a: 1 }, idempotencyKey: 'k1' });
    expect(r).toEqual({ ok: 1 });
    expect(client.post).toHaveBeenCalledWith('/x', { a: 1 }, {
      timeout: 8000,
      headers: { 'Idempotency-Key': 'k1' },
    });
    expect(onSuccess).toHaveBeenCalled();
  });
  it('PATCH honors custom timeout', async () => {
    const { t, client } = setup();
    await t.send({ method: 'PATCH', url: '/x', body: {}, idempotencyKey: 'k', timeoutMs: 1000 });
    expect(client.patch.mock.calls[0][2].timeout).toBe(1000);
  });
  it('DELETE passes body via config.data', async () => {
    const { t, client } = setup();
    await t.send({ method: 'DELETE', url: '/x', body: { b: 1 }, idempotencyKey: 'k' });
    expect(client.delete).toHaveBeenCalledWith('/x', {
      timeout: 8000,
      headers: { 'Idempotency-Key': 'k' },
      data: { b: 1 },
    });
  });
  it('DELETE without body omits data', async () => {
    const { t, client } = setup();
    await t.send({ method: 'DELETE', url: '/x', idempotencyKey: 'k' });
    expect('data' in client.delete.mock.calls[0][1]).toBe(false);
  });
  it('offline rejects network without calling client', async () => {
    const { t, client } = setup({}, true);
    await expect(t.send({ method: 'POST', url: '/x', idempotencyKey: 'k' })).rejects.toEqual({
      network: true,
      timeout: false,
    });
    expect(client.post).not.toHaveBeenCalled();
  });
  it('axios error without response -> network and onNetworkFailure', async () => {
    const { t, onNetworkFailure } = setup({ post: vi.fn().mockRejectedValue({ request: {}, message: 'Network Error' }) });
    await expect(t.send({ method: 'POST', url: '/x', idempotencyKey: 'k' })).rejects.toEqual({
      network: true,
      timeout: false,
    });
    expect(onNetworkFailure).toHaveBeenCalled();
  });
  it('OfflineError from gate -> network', async () => {
    const { t } = setup({ post: vi.fn().mockRejectedValue(new OfflineError('offline')) });
    await expect(t.send({ method: 'POST', url: '/x', idempotencyKey: 'k' })).rejects.toMatchObject({ network: true });
  });
  it('ECONNABORTED -> timeout', async () => {
    const { t, onNetworkFailure } = setup({ post: vi.fn().mockRejectedValue({ code: 'ECONNABORTED' }) });
    await expect(t.send({ method: 'POST', url: '/x', idempotencyKey: 'k' })).rejects.toEqual({
      network: false,
      timeout: true,
    });
    expect(onNetworkFailure).toHaveBeenCalled();
  });
  it('409 in flight with Retry-After', async () => {
    const err = {
      response: { status: 409, data: { code: 'IDEMPOTENCY_IN_FLIGHT' }, headers: { 'retry-after': '1' } },
    };
    const { t, onNetworkFailure } = setup({ post: vi.fn().mockRejectedValue(err) });
    await expect(t.send({ method: 'POST', url: '/x', idempotencyKey: 'k' })).rejects.toEqual({
      network: false,
      timeout: false,
      status: 409,
      code: 'IDEMPOTENCY_IN_FLIGHT',
      retryAfterMs: 1000,
    });
    expect(onNetworkFailure).not.toHaveBeenCalled();
  });
  it('status error without retry-after or code', async () => {
    const { t } = setup({ post: vi.fn().mockRejectedValue({ response: { status: 500, data: {}, headers: {} } }) });
    const e = await t.send({ method: 'POST', url: '/x', idempotencyKey: 'k' }).catch((x) => x);
    expect(e).toEqual({ network: false, timeout: false, status: 500 });
  });
  it('invalid retry-after ignored', async () => {
    const { t } = setup({
      post: vi.fn().mockRejectedValue({ response: { status: 503, headers: { 'retry-after': 'soon' } } }),
    });
    const e = (await t
      .send({ method: 'POST', url: '/x', idempotencyKey: 'k' })
      .catch((x: unknown) => x)) as { retryAfterMs?: number };
    expect(e.retryAfterMs).toBeUndefined();
  });
});

describe('offline-error', () => {
  it('gate null -> not closed', () => {
    registerOfflineGate(null);
    expect(isOfflineGateClosed()).toBe(false);
  });
  it('gate true -> closed; isOfflineError', () => {
    registerOfflineGate(() => true);
    expect(isOfflineGateClosed()).toBe(true);
    registerOfflineGate(null);
    const e = new OfflineError('offline');
    expect(e.name).toBe('OfflineError');
    expect(isOfflineError(e)).toBe(true);
    expect(isOfflineError(new Error('x'))).toBe(false);
  });
});

describe('toFailure UPGRADE_REQUIRED limit (WR-05)', () => {
  const err = (status: number, data: unknown) => ({ response: { status, data, headers: {} } });
  it('carries details.limit for UPGRADE_REQUIRED only', () => {
    expect(toFailure(err(403, { code: 'UPGRADE_REQUIRED', limit: 40 }))).toMatchObject({
      status: 403,
      code: 'UPGRADE_REQUIRED',
      limit: 40,
    });
    expect(toFailure(err(403, { code: 'OTHER', limit: 40 })).limit).toBeUndefined();
  });
});
