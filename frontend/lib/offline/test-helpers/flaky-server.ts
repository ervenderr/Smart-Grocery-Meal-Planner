// Tests only. Never import from app code.
import type { TransportFailure } from '../outbox/classify-error';
import type { Transport, TransportRequest } from '../transport';

export type FlakyStep =
  | 'drop-after-commit'
  | 'timeout'
  | 'network'
  | { status: number; code?: string; retryAfterMs?: number };

interface Stored {
  hash: string;
  response: unknown;
}

export interface FlakyServer {
  transport: Transport;
  state: { shopping: Map<string, Record<string, unknown>>; pantry: Map<string, { quantity: number }> };
  script(step: FlakyStep): void;
  applyCount(key: string): number;
  sendCount(): number;
}

const fail = (f: Partial<TransportFailure> & { status?: number }): TransportFailure => ({ network: false, timeout: false, ...f });

export function createFlakyServer(): FlakyServer {
  const state: FlakyServer['state'] = { shopping: new Map(), pantry: new Map() };
  const steps: FlakyStep[] = [];
  const stored = new Map<string, Stored>();
  const applies = new Map<string, number>();
  let sends = 0;

  function apply(req: TransportRequest): unknown {
    const path = req.url.replace(/^\/api\/v1/, '');
    const body = (req.body ?? {}) as Record<string, unknown>;
    let m: RegExpMatchArray | null;
    if (req.method === 'POST' && path === '/shopping/items') {
      state.shopping.set(body.id as string, { ...body });
      return { ...body };
    }
    if (req.method === 'POST' && path === '/pantry') {
      state.pantry.set(body.id as string, { quantity: Number(body.quantity) });
      return { ...body };
    }
    if ((m = path.match(/^\/pantry\/([^/]+)\/adjust$/))) {
      const row = state.pantry.get(m[1]);
      if (!row) throw fail({ status: 404 });
      const next = { quantity: Math.max(0, row.quantity + Number(body.delta)) };
      state.pantry.set(m[1], next);
      return { id: m[1], ...next };
    }
    if ((m = path.match(/^\/(shopping\/items|pantry)\/([^/]+)$/))) {
      const map = m[1] === 'pantry' ? state.pantry : state.shopping;
      const row = map.get(m[2]) as Record<string, unknown> | undefined;
      if (!row) throw fail({ status: 404 });
      if (req.method === 'DELETE') {
        map.delete(m[2]);
        return { id: m[2] };
      }
      const updated = { ...row, ...body };
      (map as Map<string, unknown>).set(m[2], updated);
      return updated;
    }
    throw fail({ status: 404 });
  }

  return {
    state,
    script: (step) => void steps.push(step),
    applyCount: (key) => applies.get(key) ?? 0,
    sendCount: () => sends,
    transport: {
      async send<T>(req: TransportRequest): Promise<T> {
        sends += 1;
        const step = steps.shift();
        if (step === 'network') throw fail({ network: true });
        if (step === 'timeout') throw fail({ timeout: true });
        if (step && typeof step === 'object') throw fail(step);
        const hash = JSON.stringify([req.method, req.url, req.body ?? null]);
        const prior = stored.get(req.idempotencyKey);
        if (prior) {
          if (prior.hash !== hash) throw fail({ status: 422, code: 'IDEMPOTENCY_KEY_REUSED' });
          if (step === 'drop-after-commit') throw fail({ network: true });
          return prior.response as T;
        }
        const response = apply(req);
        stored.set(req.idempotencyKey, { hash, response });
        applies.set(req.idempotencyKey, (applies.get(req.idempotencyKey) ?? 0) + 1);
        if (step === 'drop-after-commit') throw fail({ network: true });
        return response as T;
      },
    },
  };
}
