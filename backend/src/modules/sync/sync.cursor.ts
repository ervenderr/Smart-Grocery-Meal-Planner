/**
 * Opaque keyset cursor for GET /sync/bootstrap (base64url JSON, zod-validated).
 */

import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';
import type { SyncCursor } from '../../types/sync.types';

export const SYNC_SECTIONS = ['pantry', 'recipes', 'mealPlans'] as const;
export const SYNC_DEFAULT_LIMIT = 100;
export const SYNC_MAX_LIMIT = 200;
export const SYNC_CURSOR_MAX_LENGTH = 512;

const BASE64URL = /^[A-Za-z0-9_-]+$/;

const cursorSchema = z
  .object({ s: z.enum(SYNC_SECTIONS), after: z.uuid().nullable() })
  .strict();

const invalid = (): AppError =>
  new AppError('Invalid sync cursor', 400, true, { code: 'SYNC_CURSOR_INVALID' });

export function encodeCursor(cursor: SyncCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): SyncCursor {
  if (raw.length === 0 || raw.length > SYNC_CURSOR_MAX_LENGTH || !BASE64URL.test(raw)) {
    throw invalid();
  }
  try {
    const json: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    const parsed = cursorSchema.safeParse(json);
    if (!parsed.success) throw invalid();
    return parsed.data;
  } catch {
    throw invalid();
  }
}
