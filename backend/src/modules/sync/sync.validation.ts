/**
 * Query validation for GET /sync/bootstrap.
 */

import { z } from 'zod';
import {
  SYNC_CURSOR_MAX_LENGTH,
  SYNC_DEFAULT_LIMIT,
  SYNC_MAX_LIMIT,
} from './sync.cursor';

export const bootstrapQuerySchema = z
  .object({
    cursor: z.string().max(SYNC_CURSOR_MAX_LENGTH).optional(),
    limit: z.coerce.number().int().min(1).max(SYNC_MAX_LIMIT).default(SYNC_DEFAULT_LIMIT),
  })
  .strict();

export type BootstrapQuery = z.infer<typeof bootstrapQuerySchema>;
