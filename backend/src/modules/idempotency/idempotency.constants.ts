/**
 * Idempotency constants and boundary validation.
 */

import { z } from 'zod';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotency-Replayed';
export const IDEMPOTENT_METHODS_SKIPPED: readonly string[] = ['GET', 'HEAD', 'OPTIONS'];

/** An in_progress reservation older than this is treated as crashed. */
export const IDEMPOTENCY_STALE_IN_PROGRESS_MS = 120_000;
export const IDEMPOTENCY_MAX_STORED_BODY_BYTES = 512 * 1024;

export const IDEMPOTENCY_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export const IDEMPOTENCY_ERROR_CODES = {
  KEY_INVALID: 'IDEMPOTENCY_KEY_INVALID',
  KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  IN_FLIGHT: 'IDEMPOTENCY_IN_FLIGHT',
} as const;

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/);
