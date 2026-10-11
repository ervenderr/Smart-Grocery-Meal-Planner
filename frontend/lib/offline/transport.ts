import type { apiClient } from '@/lib/api/client';
import { getApiErrorCode } from '@/lib/api/errors';
import { isOfflineError } from '@/lib/api/offline-error';
import type { TransportFailure } from './outbox/classify-error';

export const OUTBOX_REQUEST_TIMEOUT_MS = 8000;

export interface TransportRequest {
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  body?: unknown;
  idempotencyKey: string;
  timeoutMs?: number;
}

export interface Transport {
  send<T>(req: TransportRequest): Promise<T>;
}

interface Deps {
  client: Pick<typeof apiClient, 'post' | 'patch' | 'delete'>;
  isOffline: () => boolean;
  onNetworkFailure?: () => void;
  onSuccess?: () => void;
}

function parseRetryAfterMs(headers: unknown): number | undefined {
  if (typeof headers !== 'object' || headers === null) return undefined;
  const h = headers as Record<string, unknown>;
  const raw = h['retry-after'] ?? h['Retry-After'];
  const secs = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  return Number.isFinite(secs) && secs >= 0 ? Math.round(secs * 1000) : undefined;
}

export function toFailure(error: unknown): TransportFailure {
  const e = error as { code?: unknown; response?: { status?: unknown; headers?: unknown } } | null;
  if (isOfflineError(error)) return { network: true, timeout: false };
  if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') return { network: false, timeout: true };
  const status = e?.response?.status;
  if (typeof status !== 'number') return { network: true, timeout: false };
  const failure: TransportFailure = { network: false, timeout: false, status };
  const code = getApiErrorCode(error);
  if (code !== undefined) failure.code = code;
  const retryAfterMs = parseRetryAfterMs(e?.response?.headers);
  if (retryAfterMs !== undefined) failure.retryAfterMs = retryAfterMs;
  return failure;
}

export function createTransport(deps: Deps): Transport {
  return {
    async send<T>(req: TransportRequest): Promise<T> {
      if (deps.isOffline()) {
        const f: TransportFailure = { network: true, timeout: false };
        throw f;
      }
      const config: Record<string, unknown> = {
        timeout: req.timeoutMs ?? OUTBOX_REQUEST_TIMEOUT_MS,
        headers: { 'Idempotency-Key': req.idempotencyKey },
      };
      try {
        let result: T;
        if (req.method === 'POST') result = await deps.client.post<T>(req.url, req.body, config);
        else if (req.method === 'PATCH') result = await deps.client.patch<T>(req.url, req.body, config);
        else {
          if (req.body !== undefined) config.data = req.body;
          result = await deps.client.delete<T>(req.url, config);
        }
        deps.onSuccess?.();
        return result;
      } catch (error) {
        const failure = toFailure(error);
        if (failure.network || failure.timeout) deps.onNetworkFailure?.();
        else deps.onSuccess?.();
        throw failure;
      }
    },
  };
}
