/**
 * Blocks AI generation routes unless the authenticated user has stored consent
 * at the current policy version. Must run before validators/controllers so no
 * request data is processed and nothing is sent to the AI provider.
 */

import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.config';
import { asyncHandler } from '../../middleware/errorHandler';
import { AI_CONSENT_VERSION } from './ai-consent.constants';
import { aiConsentRequiredError } from './ai.errors';

export const requireAiConsent = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      throw aiConsentRequiredError();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiConsentAt: true, aiConsentVersion: true },
    });

    if (!user?.aiConsentAt || (user.aiConsentVersion ?? 0) < AI_CONSENT_VERSION) {
      throw aiConsentRequiredError();
    }

    next();
  }
);
