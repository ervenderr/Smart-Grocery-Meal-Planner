import { z } from 'zod';
import type { OpKind, OutboxOp } from '../outbox/op-types';

const record = z.record(z.string(), z.unknown());
const withId = z.object({ id: z.string() }).passthrough();

/** Per-kind inverse payloads persisted on the op row (11-11 hooks write exactly these shapes). */
export const InverseSchemas: Record<OpKind, z.ZodTypeAny> = {
  'shopping.item.create': z.object({}).passthrough(),
  'shopping.item.update': z.object({ previous: record }),
  'shopping.item.delete': z.object({ item: withId }),
  'pantry.create': z.object({}).passthrough(),
  'pantry.adjust': z.object({}).passthrough(),
  'pantry.update': z.object({ previous: record }),
  'pantry.delete': z.object({ item: withId }),
  'shopping.finish': z.object({}).passthrough(),
  'cook.apply': z.object({ previousCookedAt: z.string().nullable() }),
};

export type Inverse = Record<string, unknown>;

/** Returns the validated inverse, or null when missing/invalid (caller falls back to refetch). */
export function parseInverse(op: OutboxOp): Inverse | null {
  const parsed = InverseSchemas[op.kind].safeParse(op.inverse);
  return parsed.success ? (parsed.data as Inverse) : null;
}
