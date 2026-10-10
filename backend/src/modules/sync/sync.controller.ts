/**
 * Sync controller.
 */

import type { Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { decodeCursor } from './sync.cursor';
import { getBootstrapPage } from './sync.service';
import { bootstrapQuerySchema } from './sync.validation';

export async function getBootstrap(req: Request, res: Response): Promise<void> {
  const parsed = bootstrapQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'query'}: ${i.message}`)
      .join('; ');
    throw new AppError(message, 400, true, { code: 'VALIDATION_ERROR' });
  }
  const { cursor, limit } = parsed.data;
  const userId = (req as any).user.id as string;
  const page = await getBootstrapPage(userId, cursor ? decodeCursor(cursor) : null, limit);
  res.status(200).json(page);
}
