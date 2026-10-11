import type { Connectivity } from '../connectivity/connectivity';
import type { Transport } from '../transport';
import { nextDelayMs } from './backoff';
import { classify, type TransportFailure } from './classify-error';
import type { ExecutorRegistry } from './executors';
import { IN_DOUBT_CODE } from './fold';
import type { LastError, OutboxOp } from './op-types';
import type { OutboxStore } from './store';

export type DrainEvent =
  | { type: 'started' }
  | { type: 'applied'; op: OutboxOp; result: unknown; remaining?: OutboxOp[] }
  | { type: 'parked'; op: OutboxOp; error: LastError }
  | { type: 'retry-scheduled'; op: OutboxOp; at: number }
  | { type: 'offline' }
  | { type: 'auth-paused' }
  | { type: 'finished'; applied: number; parked: number };

export interface DrainWorker {
  kick(reason: string): void;
  whenIdle(): Promise<void>;
  isDraining(): boolean;
  dispose(): void;
}

export interface DrainDeps {
  store: OutboxStore;
  transport: Transport;
  executors: ExecutorRegistry;
  connectivity: Pick<Connectivity, 'isReachable' | 'reportNetworkFailure'>;
  getUserId: () => string | null;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  onEvent?: (e: DrainEvent) => void;
}

interface Tally {
  applied: number;
  parked: number;
}

const asFailure = (e: unknown): TransportFailure => {
  const f = e as Partial<TransportFailure> | null;
  const isFailure = typeof f === 'object' && f !== null && typeof f.network === 'boolean' && typeof f.timeout === 'boolean';
  return isFailure ? (f as TransportFailure) : { network: false, timeout: false };
};

/** Server IDEMPOTENCY_TTL_HOURS (48h) minus a 6h safety margin. */
export const SAFE_REPLAY_MS = (48 - 6) * 60 * 60 * 1000;
export const REPLAY_EXPIRED_CODE = 'REPLAY_EXPIRED';

export function createDrainWorker(deps: DrainDeps): DrainWorker {
  const now = deps.now ?? Date.now;
  const replayExpired = (op: OutboxOp): boolean => {
    const since = op.lastError?.code === IN_DOUBT_CODE ? op.lastError.since : undefined;
    return since !== undefined && now() - since > SAFE_REPLAY_MS;
  };
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const emit = (e: DrainEvent): void => deps.onEvent?.(e);
  let current: Promise<void> | null = null;
  let rerun = false;
  let disposed = false;
  let timer: unknown = null;

  async function armTimer(userId: string): Promise<void> {
    if (timer !== null) clearTimer(timer);
    timer = null;
    const at = now();
    const queued = (await deps.store.list(userId)).filter((o) => o.state === 'queued' && o.nextAttemptAt > at);
    if (queued.length === 0 || disposed) return;
    const earliest = Math.min(...queued.map((o) => o.nextAttemptAt));
    timer = setTimer(() => {
      timer = null;
      worker.kick('backoff');
    }, Math.max(0, earliest - at));
  }

  async function onFailure(op: OutboxOp, userId: string, raw: unknown, tally: Tally): Promise<boolean> {
    const failure = asFailure(raw);
    const outcome = classify(failure, { kind: op.kind, attempts: op.attempts, sessionActive: deps.getUserId() === userId });
    switch (outcome.kind) {
      case 'ok':
        await deps.store.complete(op.seq);
        tally.applied += 1;
        emit({ type: 'applied', op, result: null });
        return true;
      case 'pause-auth':
        await deps.store.pauseAuth(userId);
        emit({ type: 'auth-paused' });
        return false;
      case 'park':
        await deps.store.park(op.seq, outcome.error);
        tally.parked += 1;
        emit({ type: 'parked', op, error: outcome.error });
        return true;
      case 'retry': {
        const at = now() + nextDelayMs(op.attempts, { retryAfterMs: outcome.retryAfterMs });
        // A timeout may have reached the server: record it as in doubt so refreshes replay it first.
        // Once in doubt it stays in doubt (with its start time) until a conclusive answer arrives.
        const wasInDoubt = op.lastError?.code === IN_DOUBT_CODE;
        const inDoubt = failure.timeout || wasInDoubt;
        const code = inDoubt ? IN_DOUBT_CODE : failure.code;
        const error: LastError = {
          reason: 'transient',
          ...(failure.status !== undefined ? { status: failure.status } : {}),
          ...(code !== undefined ? { code } : {}),
          ...(inDoubt ? { since: (wasInDoubt ? op.lastError?.since : undefined) ?? now() } : {}),
        };
        await deps.store.scheduleRetry(op.seq, error, at, outcome.countsAttempt);
        emit({ type: 'retry-scheduled', op, at });
        if (failure.network || failure.timeout) {
          deps.connectivity.reportNetworkFailure();
          emit({ type: 'offline' });
          return false;
        }
        return true;
      }
    }
  }

  async function sendOne(op: OutboxOp, userId: string, tally: Tally): Promise<boolean> {
    const executor = deps.executors.get(op.kind);
    if (!executor) {
      const error: LastError = { reason: 'invalid' };
      await deps.store.park(op.seq, error);
      tally.parked += 1;
      emit({ type: 'parked', op, error });
      return true;
    }
    // Claim and re-read atomically: an enqueue may have merged into or dropped this row since nextReady read it.
    const claimed = await deps.store.claim(op.seq);
    if (!claimed) return true;
    if (replayExpired(claimed)) {
      // The server's idempotency record may be gone, so a replay could apply the change twice.
      const error: LastError = { reason: 'conflict', code: REPLAY_EXPIRED_CODE };
      await deps.store.park(claimed.seq, error);
      tally.parked += 1;
      emit({ type: 'parked', op: claimed, error });
      return true;
    }
    try {
      const result = await executor.run(claimed, { transport: deps.transport, store: deps.store });
      await deps.store.complete(claimed.seq);
      tally.applied += 1;
      // Ops still pending after this one: the cache patch re-applies them over the server row.
      emit({ type: 'applied', op: claimed, result, remaining: await deps.store.list(userId) });
      return true;
    } catch (e) {
      return onFailure(claimed, userId, e, tally);
    }
  }

  async function pass(): Promise<void> {
    const userId = deps.getUserId();
    if (!userId) return;
    emit({ type: 'started' });
    // paused_auth means "waiting for this user to sign in": they are signed in now, so release them.
    if ((await deps.store.counts(userId)).pausedAuth > 0) await deps.store.resumeAuth(userId);
    const tally: Tally = { applied: 0, parked: 0 };
    if (await deps.connectivity.isReachable()) {
      for (let op = await deps.store.nextReady(userId, now()); op && !disposed; op = await deps.store.nextReady(userId, now())) {
        if (!(await sendOne(op, userId, tally))) break;
      }
    } else {
      emit({ type: 'offline' });
    }
    await armTimer(userId);
    emit({ type: 'finished', applied: tally.applied, parked: tally.parked });
  }

  async function run(): Promise<void> {
    try {
      do {
        rerun = false;
        await pass();
      } while (rerun && !disposed);
    } catch {
      // Store failure: leave rows untouched; the next kick retries. Never log payloads.
      console.error('[outbox] drain pass failed');
    } finally {
      current = null;
    }
  }

  const worker: DrainWorker = {
    kick() {
      if (disposed) return;
      if (current) {
        rerun = true;
        return;
      }
      current = run();
    },
    async whenIdle() {
      while (current) await current;
    },
    isDraining: () => current !== null,
    dispose() {
      disposed = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
  return worker;
}
