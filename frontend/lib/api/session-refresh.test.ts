import { describe, expect, it, vi } from 'vitest';
import {
  classifyRefreshFailure,
  createAuthErrorHandler,
  createRefreshCoordinator,
} from './session-refresh';

const axiosErr = (status?: number, extra: Record<string, unknown> = {}) => ({
  isAxiosError: true,
  response: status ? { status } : undefined,
  ...extra,
});

function setup(opts: { refreshToken?: string | null; request?: () => Promise<{ token: string; refreshToken: string }> } = {}) {
  const refreshRequest = vi.fn(
    opts.request ?? (async () => ({ token: 'new-a', refreshToken: 'new-r' }))
  );
  const writeTokens = vi.fn();
  const coordinator = createRefreshCoordinator({
    readRefreshToken: () => (opts.refreshToken === undefined ? 'old-r' : opts.refreshToken),
    refreshRequest,
    writeTokens,
  });
  return { coordinator, refreshRequest, writeTokens };
}

describe('classifyRefreshFailure', () => {
  it('treats 401 and 403 as definitive', () => {
    expect(classifyRefreshFailure(axiosErr(401))).toBe('definitive');
    expect(classifyRefreshFailure(axiosErr(403))).toBe('definitive');
  });
  it('treats network, timeout, 5xx and 429 as transient', () => {
    expect(classifyRefreshFailure(axiosErr(undefined))).toBe('transient');
    expect(classifyRefreshFailure(axiosErr(undefined, { code: 'ECONNABORTED' }))).toBe('transient');
    expect(classifyRefreshFailure(axiosErr(503))).toBe('transient');
    expect(classifyRefreshFailure(axiosErr(429))).toBe('transient');
    expect(classifyRefreshFailure(new Error('boom'))).toBe('transient');
  });
});

describe('createRefreshCoordinator', () => {
  it('resolves definitive without network when no refresh token is stored', async () => {
    const { coordinator, refreshRequest } = setup({ refreshToken: null });
    expect(await coordinator.refresh()).toEqual({ kind: 'definitive' });
    expect(refreshRequest).not.toHaveBeenCalled();
  });

  it('single-flights five concurrent refreshes', async () => {
    const { coordinator, refreshRequest } = setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => coordinator.refresh()));
    expect(refreshRequest).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r).toEqual({ kind: 'refreshed', token: 'new-a' });
  });

  it('writes tokens on success and starts a new request next time', async () => {
    const { coordinator, refreshRequest, writeTokens } = setup();
    await coordinator.refresh();
    expect(writeTokens).toHaveBeenCalledWith({ token: 'new-a', refreshToken: 'new-r' });
    await coordinator.refresh();
    expect(refreshRequest).toHaveBeenCalledTimes(2);
  });

  it('reports transient failures without writing tokens', async () => {
    const { coordinator, writeTokens } = setup({ request: async () => { throw axiosErr(503); } });
    const out = await coordinator.refresh();
    expect(out.kind).toBe('transient');
    expect(writeTokens).not.toHaveBeenCalled();
  });

  it('reports definitive on 401 from refresh', async () => {
    const { coordinator } = setup({ request: async () => { throw axiosErr(401); } });
    expect(await coordinator.refresh()).toEqual({ kind: 'definitive' });
  });
});

describe('createAuthErrorHandler', () => {
  const make = (coordinator: ReturnType<typeof setup>['coordinator']) => {
    const retry = vi.fn(async () => 'retried');
    const onSessionExpired = vi.fn();
    const handler = createAuthErrorHandler({ coordinator, retry, onSessionExpired });
    return { handler, retry, onSessionExpired };
  };
  const err401 = (config: Record<string, unknown> = { url: '/api/v1/pantry', headers: {} }) =>
    ({ ...axiosErr(401), config }) as never;

  it('retries once with the new bearer after a successful refresh', async () => {
    const { coordinator } = setup();
    const { handler, retry } = make(coordinator);
    const original = { url: '/api/v1/pantry', headers: { Accept: 'x' } };
    await expect(handler(err401(original))).resolves.toBe('retried');
    expect(retry).toHaveBeenCalledTimes(1);
    const sent = (retry.mock.calls[0] as unknown[])[0] as Record<string, unknown> & { headers: Record<string, string> };
    expect(sent._retry).toBe(true);
    expect(sent.headers.Authorization).toBe('Bearer new-a');
    expect(original).toEqual({ url: '/api/v1/pantry', headers: { Accept: 'x' } });
  });

  it('rejects with the original error on transient refresh failure and keeps state', async () => {
    const { coordinator } = setup({ request: async () => { throw axiosErr(500); } });
    const { handler, retry, onSessionExpired } = make(coordinator);
    const error = err401();
    await expect(handler(error)).rejects.toBe(error);
    expect(retry).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('expires the session once on definitive refresh failure', async () => {
    const { coordinator } = setup({ request: async () => { throw axiosErr(401); } });
    const { handler, onSessionExpired } = make(coordinator);
    const error = err401();
    await expect(handler(error)).rejects.toBe(error);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('expires the session when no refresh token is stored', async () => {
    const { coordinator } = setup({ refreshToken: null });
    const { handler, onSessionExpired } = make(coordinator);
    await expect(handler(err401())).rejects.toBeDefined();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not refresh again when the request was already retried', async () => {
    const { coordinator, refreshRequest } = setup();
    const { handler, retry, onSessionExpired } = make(coordinator);
    const error = err401({ url: '/api/v1/pantry', headers: {}, _retry: true });
    await expect(handler(error)).rejects.toBe(error);
    expect(refreshRequest).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('skips refresh for auth endpoints', async () => {
    const { coordinator, refreshRequest } = setup();
    const { handler } = make(coordinator);
    for (const url of ['/api/v1/auth/login', '/api/v1/auth/signup', '/api/v1/auth/refresh']) {
      const error = err401({ url, headers: {} });
      await expect(handler(error)).rejects.toBe(error);
    }
    expect(refreshRequest).not.toHaveBeenCalled();
  });

  it('passes through non-401 errors', async () => {
    const { coordinator, refreshRequest } = setup();
    const { handler } = make(coordinator);
    const error = { ...axiosErr(500), config: { url: '/x' } } as never;
    await expect(handler(error)).rejects.toBe(error);
    expect(refreshRequest).not.toHaveBeenCalled();
  });
});
