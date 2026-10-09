/**
 * Cook controller.
 */

import type { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import type { CookApplyInput, CookPreviewInput } from '../../types/cook.types';
import { applyCook, previewCook } from './cook.service';

const userIdOf = (req: Request): string => (req as any).user.id as string;

export class CookController {
  async preview(req: Request, res: Response): Promise<void> {
    const input = matchedData(req, { locations: ['body'] }) as CookPreviewInput;
    res.status(200).json(await previewCook(userIdOf(req), input));
  }

  async apply(req: Request, res: Response): Promise<void> {
    const input = matchedData(req, { locations: ['body'] }) as CookApplyInput;
    res.status(200).json(await applyCook(userIdOf(req), input));
  }
}
