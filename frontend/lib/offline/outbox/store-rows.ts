import { z } from 'zod';
import { OUTBOX_STATES } from '../sql/schema';
import { NewOpSchema, OP_KINDS, type LastError, type OutboxOp } from './op-types';

export const RowSchema = z.object({
  seq: z.number(),
  op_id: z.string(),
  idempotency_key: z.string(),
  user_id: z.string(),
  kind: z.enum(OP_KINDS),
  entity_type: z.enum(['shopping-item', 'pantry-item', 'shopping-list', 'cook']),
  entity_id: z.string(),
  payload_json: z.string(),
  inverse_json: z.string().nullable(),
  resolved_json: z.string().nullable(),
  label: z.string(),
  state: z.enum(OUTBOX_STATES),
  attempts: z.number(),
  last_error_json: z.string().nullable(),
  next_attempt_at: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
});

const parseJson = (s: string | null): unknown => (s === null ? null : JSON.parse(s));

const INVALID: LastError = { reason: 'invalid' };

/**
 * Returns null (and logs only the seq) when a stored row is structurally unreadable.
 * A readable row whose payload no longer validates is returned as failed/invalid so the
 * user can see and discard it instead of it silently blocking its entity forever.
 */
export function rowToOp(raw: unknown): OutboxOp | null {
  const seq = (raw as { seq?: unknown } | null)?.seq;
  try {
    const r = RowSchema.parse(raw);
    const payload = parseJson(r.payload_json);
    const checked = NewOpSchema.safeParse({ kind: r.kind, label: r.label, payload });
    if (!checked.success) console.warn(`[outbox] invalid payload in row seq=${String(seq)}`);
    return {
      seq: r.seq,
      opId: r.op_id,
      idempotencyKey: r.idempotency_key,
      userId: r.user_id,
      kind: r.kind,
      entityType: r.entity_type,
      entityId: r.entity_id,
      payload: checked.success ? checked.data.payload : (payload as OutboxOp['payload']),
      inverse: parseJson(r.inverse_json),
      resolved: parseJson(r.resolved_json),
      label: r.label,
      state: checked.success ? r.state : 'failed',
      attempts: r.attempts,
      lastError: checked.success ? (parseJson(r.last_error_json) as LastError | null) : INVALID,
      nextAttemptAt: r.next_attempt_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch {
    console.warn(`[outbox] skipping unreadable row seq=${String(seq)}`);
    return null;
  }
}

export const toJson = (v: unknown): string | null => (v === undefined || v === null ? null : JSON.stringify(v));
