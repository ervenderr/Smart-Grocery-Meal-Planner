import type { SqlDb } from '../sql/types';
import { newId } from '../ids';
import { planEnqueue } from './coalesce';
import { IN_DOUBT_CODE } from './fold';
import { NewOpSchema, barrierFor, entityOf, type LastError, type NewOp, type OutboxOp } from './op-types';
import { rowToOp, toJson } from './store-rows';

const KEY_RE = /^[A-Za-z0-9._:-]{8,255}$/;
// An op enqueued with caller-supplied key/body was already sent once: mark it so it is never coalesced.
const SENT_MARK: LastError = { reason: 'transient' };
const OPEN_STATES = `('queued','in_flight','failed','blocked','paused_auth')`;

export interface OutboxCounts {
  queued: number;
  inFlight: number;
  failed: number;
  blocked: number;
  pausedAuth: number;
}

export interface EnqueueOpts {
  idempotencyKey?: string;
  resolved?: unknown;
}

export interface OutboxStore {
  enqueue(userId: string, op: NewOp, opts?: EnqueueOpts): Promise<OutboxOp | null>;
  list(userId: string): Promise<OutboxOp[]>;
  nextReady(userId: string, now: number): Promise<OutboxOp | null>;
  markInFlight(seq: number): Promise<void>;
  /** Atomically marks a still-queued op in flight and returns the row as stored now; null if it changed state or was removed. */
  claim(seq: number): Promise<OutboxOp | null>;
  complete(seq: number): Promise<void>;
  scheduleRetry(seq: number, error: LastError, nextAttemptAt: number, countsAttempt: boolean): Promise<void>;
  park(seq: number, error: LastError): Promise<void>;
  pauseAuth(userId: string): Promise<void>;
  resumeAuth(userId: string): Promise<void>;
  saveResolved(seq: number, body: unknown): Promise<void>;
  retry(seq: number): Promise<void>;
  discard(seq: number): Promise<OutboxOp[]>;
  discardAllFailed(userId: string): Promise<OutboxOp[]>;
  resetInFlight(): Promise<number>;
  /** Removes every op of one user (account deletion only). */
  deleteForUser(userId: string): Promise<number>;
  counts(userId: string): Promise<OutboxCounts>;
  subscribe(listener: () => void): () => void;
}

const mapRows = (rows: unknown[]): OutboxOp[] => rows.map(rowToOp).filter((o): o is OutboxOp => o !== null);

async function getBySeq(db: SqlDb, seq: number): Promise<OutboxOp | null> {
  const rows = await db.query<unknown>('SELECT * FROM outbox WHERE seq = ?', [seq]);
  return mapRows(rows)[0] ?? null;
}

async function pendingFor(db: SqlDb, userId: string, entityType: string, entityId: string): Promise<OutboxOp[]> {
  const rows = await db.query<unknown>(
    'SELECT * FROM outbox WHERE user_id = ? AND entity_type = ? AND entity_id = ? ORDER BY seq',
    [userId, entityType, entityId]
  );
  return mapRows(rows);
}

async function insertRow(db: SqlDb, userId: string, op: NewOp, now: number, opts: EnqueueOpts | undefined, blocked: boolean): Promise<number> {
  const { entityType, entityId } = entityOf(op);
  const opId = newId();
  const res = await db.run(
    `INSERT INTO outbox (op_id, idempotency_key, user_id, kind, entity_type, entity_id, payload_json,
       inverse_json, resolved_json, label, state, attempts, last_error_json, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
    [opId, opts?.idempotencyKey ?? newId(), userId, op.kind, entityType, entityId, JSON.stringify(op.payload),
      toJson(op.inverse), toJson(opts?.resolved), op.label, blocked ? 'blocked' : 'queued',
      opts ? JSON.stringify(SENT_MARK) : null, now, now]
  );
  if (typeof res.lastInsertRowid === 'number' && Number.isFinite(res.lastInsertRowid)) return res.lastInsertRowid;
  // The native plugin may omit changes.lastId: find the row by its unique op id instead.
  const rows = await db.query<{ seq: number }>('SELECT seq FROM outbox WHERE op_id = ?', [opId]);
  if (!rows[0]) throw new Error('Outbox insert did not produce a row');
  return rows[0].seq;
}

export function createOutboxStore({ db, now = Date.now }: { db: SqlDb; now?: () => number }): OutboxStore {
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((l) => l());
  const mutate = async <T>(fn: (tx: SqlDb) => Promise<T>): Promise<T> => {
    const out = await db.transaction(fn);
    notify();
    return out;
  };
  const setState = (sql: string, params: readonly unknown[]) => mutate(async (tx) => void (await tx.run(sql, params)));

  async function enqueue(userId: string, input: NewOp, opts?: EnqueueOpts): Promise<OutboxOp | null> {
    const op = NewOpSchema.parse(input);
    if (opts?.idempotencyKey !== undefined && !KEY_RE.test(opts.idempotencyKey)) {
      throw new Error('Invalid idempotency key');
    }
    return mutate(async (tx) => {
      const { entityType, entityId } = entityOf(op);
      const pending = await pendingFor(tx, userId, entityType, entityId);
      const plan = opts ? ({ type: 'insert' } as const) : planEnqueue(pending, op);
      if (plan.type === 'merge') {
        const target = pending.find((p) => p.seq === plan.seq);
        const valid = target !== undefined && NewOpSchema.safeParse({ kind: target.kind, label: target.label, payload: plan.payload }).success;
        if (valid) {
          await tx.run('UPDATE outbox SET payload_json = ?, inverse_json = ?, updated_at = ? WHERE seq = ?',
            [JSON.stringify(plan.payload), toJson(plan.inverse), now(), plan.seq]);
          return getBySeq(tx, plan.seq);
        }
        // Never write a merged payload that would fail validation on read: queue the op on its own instead.
        const blockedMerge = pending.some((p) => p.state === 'failed' || p.state === 'blocked');
        return getBySeq(tx, await insertRow(tx, userId, op, now(), opts, blockedMerge));
      }
      if (plan.type === 'drop') {
        for (const seq of plan.seqs) await tx.run('DELETE FROM outbox WHERE seq = ?', [seq]);
        if (!plan.insert) return null;
      }
      const dropped = plan.type === 'drop' ? new Set(plan.seqs) : new Set<number>();
      const blocked = pending.some((p) => !dropped.has(p.seq) && (p.state === 'failed' || p.state === 'blocked'));
      return getBySeq(tx, await insertRow(tx, userId, op, now(), opts, blocked));
    });
  }

  function parkOp(seq: number, error: LastError): Promise<void> {
    return mutate(async (tx) => {
      const op = await getBySeq(tx, seq);
      if (!op) return;
      await tx.run(`UPDATE outbox SET state = 'failed', last_error_json = ?, updated_at = ? WHERE seq = ?`,
        [JSON.stringify(error), now(), seq]);
      await tx.run(
        `UPDATE outbox SET state = 'blocked', updated_at = ? WHERE user_id = ? AND entity_type = ? AND entity_id = ? AND seq > ? AND state = 'queued'`,
        [now(), op.userId, op.entityType, op.entityId, seq]
      );
    });
  }

  async function hasEarlierBarrier(op: OutboxOp, userId: string): Promise<boolean> {
    for (const type of barrierFor(op.kind) ?? []) {
      const rows = await db.query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM outbox WHERE user_id = ? AND seq < ? AND entity_type = ? AND state IN ${OPEN_STATES}`,
        [userId, op.seq, type]
      );
      if (rows[0].n > 0) return true;
    }
    return false;
  }

  async function nextReady(userId: string, at: number): Promise<OutboxOp | null> {
    const rows = await db.query<unknown>(
      `SELECT o.* FROM outbox o WHERE o.user_id = ? AND o.state = 'queued' AND o.next_attempt_at <= ?
         AND NOT EXISTS (SELECT 1 FROM outbox e WHERE e.user_id = o.user_id AND e.entity_type = o.entity_type
           AND e.entity_id = o.entity_id AND e.seq < o.seq AND e.state IN ${OPEN_STATES})
       ORDER BY o.seq`,
      [userId, at]
    );
    for (const op of mapRows(rows)) {
      if (op.state !== 'queued') {
        // Row read back as failed/invalid (payload no longer validates): persist that so dependents park visibly.
        await parkOp(op.seq, op.lastError ?? { reason: 'invalid' });
        continue;
      }
      if (!(await hasEarlierBarrier(op, userId))) return op;
    }
    return null;
  }

  async function discardOne(tx: SqlDb, seq: number): Promise<OutboxOp[]> {
    const op = await getBySeq(tx, seq);
    if (!op) return [];
    const deps = await tx.query<unknown>(
      `SELECT * FROM outbox WHERE user_id = ? AND entity_type = ? AND entity_id = ? AND seq > ? AND state = 'blocked' ORDER BY seq`,
      [op.userId, op.entityType, op.entityId, seq]
    );
    const all = [op, ...mapRows(deps)];
    for (const o of all) await tx.run('DELETE FROM outbox WHERE seq = ?', [o.seq]);
    return all;
  }

  return {
    enqueue,
    async list(userId) {
      return mapRows(await db.query<unknown>('SELECT * FROM outbox WHERE user_id = ? ORDER BY seq', [userId]));
    },
    nextReady,
    markInFlight: (seq) => setState(`UPDATE outbox SET state = 'in_flight', updated_at = ? WHERE seq = ?`, [now(), seq]),
    claim: (seq) =>
      mutate(async (tx) => {
        const current = await getBySeq(tx, seq);
        if (!current || current.state !== 'queued') return null;
        const at = now();
        await tx.run(`UPDATE outbox SET state = 'in_flight', updated_at = ? WHERE seq = ? AND state = 'queued'`, [at, seq]);
        return { ...current, state: 'in_flight' as const, updatedAt: at };
      }),
    complete: (seq) => setState('DELETE FROM outbox WHERE seq = ?', [seq]),
    scheduleRetry: (seq, error, nextAttemptAt, countsAttempt) =>
      setState(
        `UPDATE outbox SET state = 'queued', attempts = attempts + ?, last_error_json = ?, next_attempt_at = ?, updated_at = ? WHERE seq = ?`,
        [countsAttempt ? 1 : 0, JSON.stringify(error), nextAttemptAt, now(), seq]
      ),
    park: parkOp,
    pauseAuth: (userId) =>
      mutate(async (tx) => {
        await tx.run(`UPDATE outbox SET state = 'paused_auth', last_error_json = ?, updated_at = ? WHERE user_id = ? AND state = 'in_flight'`,
          [JSON.stringify({ reason: 'auth', status: 401 }), now(), userId]);
        await tx.run(`UPDATE outbox SET state = 'paused_auth', updated_at = ? WHERE user_id = ? AND state = 'queued'`, [now(), userId]);
      }),
    resumeAuth: (userId) =>
      setState(`UPDATE outbox SET state = 'queued', next_attempt_at = 0, updated_at = ? WHERE user_id = ? AND state = 'paused_auth'`, [now(), userId]),
    saveResolved: (seq, body) =>
      setState('UPDATE outbox SET resolved_json = ?, updated_at = ? WHERE seq = ? AND resolved_json IS NULL', [JSON.stringify(body), now(), seq]),
    retry: (seq) =>
      mutate(async (tx) => {
        const op = await getBySeq(tx, seq);
        if (!op || op.state !== 'failed') return;
        await tx.run(`UPDATE outbox SET state = 'queued', next_attempt_at = 0, updated_at = ? WHERE seq = ?`, [now(), seq]);
        await tx.run(
          `UPDATE outbox SET state = 'queued', updated_at = ? WHERE user_id = ? AND entity_type = ? AND entity_id = ? AND seq > ? AND state = 'blocked'`,
          [now(), op.userId, op.entityType, op.entityId, seq]
        );
      }),
    discard: (seq) => mutate((tx) => discardOne(tx, seq)),
    discardAllFailed: (userId) =>
      mutate(async (tx) => {
        const failed = await tx.query<{ seq: number }>(`SELECT seq FROM outbox WHERE user_id = ? AND state = 'failed' ORDER BY seq`, [userId]);
        const out: OutboxOp[] = [];
        for (const { seq } of failed) out.push(...(await discardOne(tx, seq)));
        return out;
      }),
    deleteForUser: (userId) =>
      mutate(async (tx) => (await tx.run('DELETE FROM outbox WHERE user_id = ?', [userId])).changes),
    resetInFlight: () =>
      mutate(async (tx) => {
        const res = await tx.run(
          `UPDATE outbox SET state = 'queued', last_error_json = ?, updated_at = ? WHERE state = 'in_flight'`,
          // Killed while in flight: the server may have applied it, so it is in doubt until replayed.
          [JSON.stringify({ reason: 'transient', code: IN_DOUBT_CODE }), now()]
        );
        return res.changes;
      }),
    async counts(userId) {
      const rows = await db.query<{ state: string; n: number }>(
        'SELECT state, COUNT(*) AS n FROM outbox WHERE user_id = ? GROUP BY state', [userId]);
      const n = (s: string): number => rows.find((r) => r.state === s)?.n ?? 0;
      return { queued: n('queued'), inFlight: n('in_flight'), failed: n('failed'), blocked: n('blocked'), pausedAuth: n('paused_auth') };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
