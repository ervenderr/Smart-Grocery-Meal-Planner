/**
 * Verify a StoreKit 2 JWS, claim it for exactly one account and report status.
 * The client is never trusted: every call re-verifies the signed transaction.
 */

import { Prisma, type Entitlement } from '@prisma/client';
import { prisma } from '../../config/database.config';
import { config } from '../../config/env.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import { resolveUserLimits } from '../ai/ai-limits';
import { AppleVerificationError, type VerifiedTransaction } from './apple-verifier';
import { getAppleVerifier } from './entitlements.deps';
import { ENTITLEMENT_ERROR_CODES, ENTITLEMENT_STATUS } from './entitlements.constants';
import { getEntitlementSummary } from './entitlement-status';

export interface EntitlementView {
  status: 'active' | 'revoked';
  productId: string;
  environment: string;
  purchasedAt: string;
}

export interface EntitlementMeView {
  status: 'active' | 'revoked' | 'none';
  productId: string;
  environment: string | null;
  purchasedAt: string | null;
  revokedAt: string | null;
  limits: { pantry: number | null; aiDaily: number; aiMonthly: number | null };
}

const NON_CONSUMABLE = 'Non-Consumable';

function toView(row: Entitlement): EntitlementView {
  return {
    status: row.status === ENTITLEMENT_STATUS.ACTIVE ? 'active' : 'revoked',
    productId: row.productId,
    environment: row.environment,
    purchasedAt: row.purchasedAt.toISOString(),
  };
}

function alreadyClaimed(): AppError {
  return new AppError('This purchase is already linked to another account.', 409, true, {
    code: ENTITLEMENT_ERROR_CODES.ENTITLEMENT_ALREADY_CLAIMED,
  });
}

function invalidTransaction(): AppError {
  return new AppError('The purchase could not be verified.', 400, true, {
    code: ENTITLEMENT_ERROR_CODES.INVALID_TRANSACTION,
  });
}

function mapVerificationError(err: unknown): AppError {
  const kind = err instanceof AppleVerificationError ? err.kind : 'invalid';
  if (kind === 'retryable') {
    return new AppError('Purchase verification is temporarily unavailable. Please try again.', 503, true, {
      code: ENTITLEMENT_ERROR_CODES.VERIFICATION_UNAVAILABLE,
    });
  }
  if (kind === 'not_configured') {
    return new AppError('Purchases are not available yet.', 503, true, {
      code: ENTITLEMENT_ERROR_CODES.IAP_NOT_CONFIGURED,
    });
  }
  return invalidTransaction();
}

async function verifyJws(signedTransaction: string): Promise<VerifiedTransaction> {
  let verified: VerifiedTransaction;
  try {
    verified = await getAppleVerifier().verifyTransaction(signedTransaction);
  } catch (err) {
    throw mapVerificationError(err);
  }
  if (verified.productId !== config.iap.productId || verified.type !== NON_CONSUMABLE) {
    throw invalidTransaction();
  }
  return verified;
}

function sameIdentity(row: Entitlement, tx: VerifiedTransaction): boolean {
  return row.environment === tx.environment && row.originalTransactionId === tx.originalTransactionId;
}

/** Upserts the entitlement for a verified transaction. Reused by the webhook. */
export async function applyVerifiedTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  verified: VerifiedTransaction,
): Promise<EntitlementView> {
  const owner = await tx.entitlement.findUnique({
    where: {
      environment_originalTransactionId: {
        environment: verified.environment,
        originalTransactionId: verified.originalTransactionId,
      },
    },
  });
  if (owner && owner.userId !== userId) throw alreadyClaimed();

  const existing = owner ?? (await tx.entitlement.findUnique({
    where: { userId_productId: { userId, productId: verified.productId } },
  }));
  if (existing) {
    const stale = verified.signedDate.getTime() < existing.lastSignedAt.getTime();
    const differentPurchase = !sameIdentity(existing, verified);
    // Never let an older message, or a different purchase, replace an active entitlement.
    if (stale || (differentPurchase && existing.status === ENTITLEMENT_STATUS.ACTIVE)) {
      return toView(existing);
    }
  }

  const revoked = verified.revocationDate !== null;
  const data = {
    originalTransactionId: verified.originalTransactionId,
    latestTransactionId: verified.transactionId,
    environment: verified.environment,
    status: revoked ? ENTITLEMENT_STATUS.REVOKED : ENTITLEMENT_STATUS.ACTIVE,
    purchasedAt: verified.purchaseDate,
    revokedAt: verified.revocationDate,
    revocationReason: revoked ? verified.revocationReason : null,
    lastSignedAt: verified.signedDate,
  };
  const row = await tx.entitlement.upsert({
    where: { userId_productId: { userId, productId: verified.productId } },
    create: { userId, productId: verified.productId, ...data },
    update: data,
  });
  return toView(row);
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

async function resolveRace(userId: string, verified: VerifiedTransaction): Promise<EntitlementView> {
  const winner = await prisma.entitlement.findUnique({
    where: {
      environment_originalTransactionId: {
        environment: verified.environment,
        originalTransactionId: verified.originalTransactionId,
      },
    },
  });
  if (winner && winner.userId === userId) return toView(winner);
  throw alreadyClaimed();
}

export async function verifyAndClaim(userId: string, signedTransaction: string): Promise<EntitlementView> {
  const verified = await verifyJws(signedTransaction);
  let view: EntitlementView;
  try {
    view = await prisma.$transaction((tx) => applyVerifiedTransaction(tx, userId, verified));
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    view = await resolveRace(userId, verified);
  }
  logger.info('Entitlement verified', {
    userId,
    originalTransactionId: verified.originalTransactionId,
    environment: verified.environment,
    status: view.status,
  });
  return view;
}

export async function getMe(userId: string): Promise<EntitlementMeView> {
  const summary = await getEntitlementSummary(userId);
  const entitled = summary.status === 'active';
  const ai = resolveUserLimits(entitled, {
    userDaily: config.ai.userDailyLimit,
    globalDaily: config.ai.globalDailyLimit,
    paidUserDaily: config.ai.paidUserDailyLimit,
    freeMonthly: config.ai.freeMonthlyLimit,
    paidMonthly: config.ai.paidMonthlyLimit,
  });
  return {
    status: summary.status,
    productId: summary.productId,
    environment: summary.environment,
    purchasedAt: summary.purchasedAt ? summary.purchasedAt.toISOString() : null,
    revokedAt: summary.revokedAt ? summary.revokedAt.toISOString() : null,
    limits: {
      pantry: entitled ? null : config.entitlements.freePantryLimit,
      aiDaily: ai.userDaily,
      aiMonthly: ai.userMonthly,
    },
  };
}
