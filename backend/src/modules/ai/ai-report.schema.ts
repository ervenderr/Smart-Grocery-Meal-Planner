/**
 * Validation for user reports of AI-generated content.
 */

import { z } from 'zod';

export const AI_REPORT_KINDS = ['recipe', 'meal_plan', 'substitution'] as const;
export const AI_REPORT_REASONS = [
  'inaccurate_or_unsafe',
  'offensive',
  'diet_or_allergy_mismatch',
  'other',
] as const;
export const MAX_REPORT_SNAPSHOT_BYTES = 8192;
export const MAX_REPORT_NOTE = 500;
export const MAX_REPORT_REF_ID = 100;

export const REPORT_PII_KEYS: ReadonlySet<string> = new Set([
  'email',
  'firstName',
  'lastName',
  'userId',
]);
export const MAX_REPORT_SNAPSHOT_DEPTH = 8;

// Control characters except \t and \n. NUL in particular is rejected by Postgres JSONB.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

const stripControl = (text: string): string => text.replace(CONTROL_CHARS, '');

/** Pure: returns a copy without PII keys, control chars, or nesting beyond the depth limit. */
export function sanitizeSnapshotValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return stripControl(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_REPORT_SNAPSHOT_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSnapshotValue(item, depth + 1) ?? null);
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !REPORT_PII_KEYS.has(key))
    .map(([key, v]) => [stripControl(key), sanitizeSnapshotValue(v, depth + 1)] as const)
    .filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries);
}

export const aiReportBodySchema = z.object({
  kind: z.enum(AI_REPORT_KINDS),
  reason: z.enum(AI_REPORT_REASONS),
  note: z.string().trim().max(MAX_REPORT_NOTE).transform(stripControl).optional(),
  refId: z.string().trim().min(1).max(MAX_REPORT_REF_ID).transform(stripControl).optional(),
  snapshot: z
    .record(z.string(), z.unknown())
    .transform((v) => sanitizeSnapshotValue(v) as Record<string, unknown>)
    .refine((v) => Buffer.byteLength(JSON.stringify(v), 'utf8') <= MAX_REPORT_SNAPSHOT_BYTES, {
      message: `snapshot must be at most ${MAX_REPORT_SNAPSHOT_BYTES} bytes`,
    }),
});

export type AiReportInput = z.infer<typeof aiReportBodySchema>;
