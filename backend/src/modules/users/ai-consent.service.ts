/**
 * AI consent record service (STORE-02).
 *
 * Consent is server-stamped: timestamp and version are never taken from the
 * client. "Consented" uses the same rule as the requireAiConsent gate.
 */

import { prisma } from '@/config/database.config';
import { AppError } from '@/middleware/errorHandler';
import { AI_CONSENT_VERSION } from '@/modules/ai/ai-consent.constants';

export interface AiConsentStatus {
  consented: boolean;
  consentedAt: string | null;
  version: number | null;
  currentVersion: number;
}

interface ConsentFields {
  aiConsentAt: Date | null;
  aiConsentVersion: number | null;
}

const CONSENT_SELECT = { aiConsentAt: true, aiConsentVersion: true } as const;

export function toAiConsentStatus(fields: ConsentFields): AiConsentStatus {
  const { aiConsentAt, aiConsentVersion } = fields;
  return {
    consented: aiConsentAt != null && (aiConsentVersion ?? 0) >= AI_CONSENT_VERSION,
    consentedAt: aiConsentAt ? aiConsentAt.toISOString() : null,
    version: aiConsentVersion,
    currentVersion: AI_CONSENT_VERSION,
  };
}

async function readFields(userId: string): Promise<ConsentFields> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: CONSENT_SELECT });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
}

export async function getAiConsent(userId: string): Promise<AiConsentStatus> {
  return toAiConsentStatus(await readFields(userId));
}

export async function grantAiConsent(userId: string): Promise<AiConsentStatus> {
  const current = toAiConsentStatus(await readFields(userId));
  if (current.consented) {
    return current;
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { aiConsentAt: new Date(), aiConsentVersion: AI_CONSENT_VERSION },
    select: CONSENT_SELECT,
  });
  return toAiConsentStatus(updated);
}

export async function withdrawAiConsent(userId: string): Promise<AiConsentStatus> {
  await readFields(userId);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { aiConsentAt: null, aiConsentVersion: null },
    select: CONSENT_SELECT,
  });
  return toAiConsentStatus(updated);
}
