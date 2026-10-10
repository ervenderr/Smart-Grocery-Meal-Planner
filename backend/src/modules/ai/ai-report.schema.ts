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

export const aiReportBodySchema = z.object({
  kind: z.enum(AI_REPORT_KINDS),
  reason: z.enum(AI_REPORT_REASONS),
  note: z.string().trim().max(MAX_REPORT_NOTE).optional(),
  refId: z.string().max(MAX_REPORT_REF_ID).optional(),
  snapshot: z
    .record(z.string(), z.unknown())
    .refine((v) => Buffer.byteLength(JSON.stringify(v), 'utf8') <= MAX_REPORT_SNAPSHOT_BYTES, {
      message: `snapshot must be at most ${MAX_REPORT_SNAPSHOT_BYTES} bytes`,
    }),
});

export type AiReportInput = z.infer<typeof aiReportBodySchema>;
