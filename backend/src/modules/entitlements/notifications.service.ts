/**
 * App Store Server Notifications V2: refunds, revocations and reversals.
 * The signed payload is the only authentication; the dedupe row and the
 * entitlement update share one transaction so a failed update is retried by Apple.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import {
  AppleVerificationError,
  type VerifiedNotification,
  type VerifiedTransaction,
} from './apple-verifier';
import { getAppleVerifier } from './entitlements.deps';
import { ENTITLEMENT_ERROR_CODES } from './entitlements.constants';
import { applyVerifiedTransaction } from './entitlements.service';
import { lockPurchase } from './entitlement-lock';
import {
  REVERSING_TYPE,
  REVOKING_TYPES,
  recordRevocationState,
  tracksRevocation,
} from './revocation-tombstone';

export type NotificationOutcome = 'applied' | 'duplicate' | 'ignored' | 'no_entitlement';

const HANDLED_TYPES: ReadonlySet<string> = new Set([
  'REFUND',
  'REVOKE',
  'REFUND_REVERSED',
  'ONE_TIME_CHARGE',
]);

function mapVerificationError(err: unknown): AppError {
  const kind = err instanceof AppleVerificationError ? err.kind : 'invalid';
  if (kind === 'retryable') {
    return new AppError('Verification is temporarily unavailable.', 503, true, {
      code: ENTITLEMENT_ERROR_CODES.VERIFICATION_UNAVAILABLE,
    });
  }
  return new AppError('The notification could not be verified.', 400, true, {
    code: ENTITLEMENT_ERROR_CODES.INVALID_TRANSACTION,
  });
}

async function verify(signedPayload: string): Promise<VerifiedNotification> {
  try {
    return await getAppleVerifier().verifyNotification(signedPayload);
  } catch (err) {
    throw mapVerificationError(err);
  }
}

/**
 * Builds the transaction to apply: the notification's signedDate drives ordering,
 * and revocation state follows the notification type, not payload quirks.
 */
function effectiveTransaction(n: VerifiedNotification, base: VerifiedTransaction): VerifiedTransaction {
  const revoked = REVOKING_TYPES.has(n.notificationType);
  const restored = n.notificationType === REVERSING_TYPE;
  let revocationDate = base.revocationDate;
  if (revoked) revocationDate = base.revocationDate ?? n.signedDate;
  if (restored) revocationDate = null;
  return {
    ...base,
    signedDate: n.signedDate,
    revocationDate,
    revocationReason: revocationDate === null ? null : base.revocationReason,
  };
}

async function applyNotification(
  tx: Prisma.TransactionClient,
  n: VerifiedNotification,
): Promise<NotificationOutcome> {
  if (!HANDLED_TYPES.has(n.notificationType) || n.transaction === null) return 'ignored';
  const effective = effectiveTransaction(n, n.transaction);
  // Lock before reading so a concurrent claim cannot interleave (WR-02).
  await lockPurchase(tx, effective.environment, effective.originalTransactionId);
  if (tracksRevocation(n.notificationType)) {
    // Remember the refund/reversal even when nobody has claimed the purchase yet.
    await recordRevocationState(tx, {
      environment: effective.environment,
      originalTransactionId: effective.originalTransactionId,
      revokedAt: effective.revocationDate,
      revocationReason: effective.revocationReason,
      signedAt: effective.signedDate,
    });
  }
  const row = await tx.entitlement.findUnique({
    where: {
      environment_originalTransactionId: {
        environment: n.transaction.environment,
        originalTransactionId: n.transaction.originalTransactionId,
      },
    },
  });
  if (!row) return 'no_entitlement';
  if (n.signedDate.getTime() < row.lastSignedAt.getTime()) return 'ignored';
  await applyVerifiedTransaction(tx, row.userId, effective);
  return 'applied';
}

export async function handleAppStoreNotification(signedPayload: string): Promise<NotificationOutcome> {
  const n = await verify(signedPayload);

  const outcome = await prisma.$transaction(async (tx): Promise<NotificationOutcome> => {
    const created = await tx.appStoreNotification.createMany({
      data: [
        {
          notificationUuid: n.notificationUUID,
          notificationType: n.notificationType,
          subtype: n.subtype,
          environment: n.environment,
        },
      ],
      skipDuplicates: true,
    });
    if (created.count === 0) return 'duplicate';
    return applyNotification(tx, n);
  });

  logger.info('App Store notification handled', {
    notificationType: n.notificationType,
    notificationUUID: n.notificationUUID,
    environment: n.environment,
    originalTransactionId: n.transaction?.originalTransactionId,
    outcome,
  });
  return outcome;
}
