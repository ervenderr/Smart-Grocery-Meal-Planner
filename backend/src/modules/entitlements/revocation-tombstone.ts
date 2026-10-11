/**
 * Refund/revoke tombstones (CR-01).
 *
 * Apple sends REFUND/REVOKE/REFUND_REVERSED once. If no account has claimed the
 * purchase yet, the state must still be remembered: the original purchase JWS
 * carries no revocationDate and stays valid forever, so a saved copy could be
 * claimed after the refund. The newest notification (by signedDate) wins.
 */

import type { Prisma } from '@prisma/client';
import type { VerifiedTransaction } from './apple-verifier';

export const REVOKING_TYPES: ReadonlySet<string> = new Set(['REFUND', 'REVOKE']);
export const REVERSING_TYPE = 'REFUND_REVERSED';

export interface RevocationState {
  readonly environment: string;
  readonly originalTransactionId: string;
  /** null means the revocation was reversed. */
  readonly revokedAt: Date | null;
  readonly revocationReason: number | null;
  readonly signedAt: Date;
}

export function tracksRevocation(notificationType: string): boolean {
  return REVOKING_TYPES.has(notificationType) || notificationType === REVERSING_TYPE;
}

/** Columns are TIMESTAMP (UTC, no zone) like Prisma's own writes; pass ISO text, convert in SQL. */
function utcIso(d: Date | null): string | null {
  return d === null ? null : d.toISOString();
}

/** Stores the state unless a newer one is already recorded (atomic upsert). */
export async function recordRevocationState(
  tx: Prisma.TransactionClient,
  state: RevocationState,
): Promise<void> {
  const revokedAt = utcIso(state.revokedAt);
  const signedAt = utcIso(state.signedAt);
  await tx.$executeRaw`
    INSERT INTO app_store_revocations
      (environment, original_transaction_id, revoked_at, revocation_reason, last_signed_at)
    VALUES
      (${state.environment}, ${state.originalTransactionId},
       (${revokedAt}::timestamptz AT TIME ZONE 'UTC'),
       ${state.revocationReason}::integer,
       (${signedAt}::timestamptz AT TIME ZONE 'UTC'))
    ON CONFLICT (environment, original_transaction_id) DO UPDATE SET
      revoked_at = EXCLUDED.revoked_at,
      revocation_reason = EXCLUDED.revocation_reason,
      last_signed_at = EXCLUDED.last_signed_at
    WHERE app_store_revocations.last_signed_at <= EXCLUDED.last_signed_at`;
}

/**
 * Returns the transaction with any newer-or-equal tombstone applied. A tombstone
 * signed at or after the JWS describes a later state of the same purchase.
 */
export async function withRevocationState(
  tx: Prisma.TransactionClient,
  verified: VerifiedTransaction,
): Promise<VerifiedTransaction> {
  const tomb = await tx.appStoreRevocation.findUnique({
    where: {
      environment_originalTransactionId: {
        environment: verified.environment,
        originalTransactionId: verified.originalTransactionId,
      },
    },
  });
  if (!tomb || tomb.lastSignedAt.getTime() < verified.signedDate.getTime()) return verified;
  return {
    ...verified,
    signedDate: tomb.lastSignedAt,
    revocationDate: tomb.revokedAt,
    revocationReason: tomb.revokedAt === null ? null : tomb.revocationReason,
  };
}
