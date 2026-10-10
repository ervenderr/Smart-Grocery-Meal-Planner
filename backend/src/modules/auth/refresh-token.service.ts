/**
 * Refresh token service (SYNC-04)
 *
 * - Tokens are 256-bit CSPRNG values, stored only as sha256 hex hashes.
 * - Every use rotates the token within a family.
 * - A just-rotated token presented again within `reuseGraceSeconds` yields a fresh
 *   successor (a lost refresh response must not log the user out). This is a
 *   deliberate relaxation of strict reuse detection (research A2).
 * - Presenting a rotated token after the grace window revokes the whole family.
 *
 * Raw tokens and hashes are never logged; only userId and familyId.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database.config';
import { config } from '@/config/env.config';
import { logger } from '@/config/logger.config';
import { AppError } from '@/middleware/errorHandler';

const REFRESH_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Absolute lifetime of a token family, regardless of rotations (WR-04). */
export const MAX_FAMILY_DAYS = 180;
/** Max concurrently active families (devices/sessions) per user (WR-04). */
export const MAX_ACTIVE_FAMILIES_PER_USER = 10;
const INVALID_MESSAGE = 'Invalid or expired refresh token';

export type RevokeReason = 'rotated' | 'logout' | 'reuse' | 'password_change' | 'inactive' | 'family_cap';

export interface IssuedRefreshToken {
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly familyId: string;
}

export interface RotatedRefreshToken {
  readonly userId: string;
  readonly email: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

type Client = Prisma.TransactionClient | typeof prisma;

type RotationOutcome =
  | { readonly ok: true; readonly value: RotatedRefreshToken }
  | { readonly ok: false; readonly code: 'REFRESH_TOKEN_INVALID' | 'REFRESH_TOKEN_REUSED' };

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateRawToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/**
 * Issues a token. `familyStartedAt` (rotation) caps expiry at the family's
 * absolute lifetime; a brand-new family also enforces the per-user family cap.
 */
export async function issueRefreshToken(
  userId: string,
  familyId?: string,
  client: Client = prisma,
  now: Date = new Date(),
  familyStartedAt: Date = now
): Promise<IssuedRefreshToken> {
  const isNewFamily = familyId === undefined;
  const resolvedFamilyId = familyId ?? randomUUID();
  const refreshToken = generateRawToken();
  const slidingExpiry = now.getTime() + config.refreshToken.ttlDays * DAY_MS;
  const absoluteExpiry = familyStartedAt.getTime() + MAX_FAMILY_DAYS * DAY_MS;
  const refreshExpiresAt = new Date(Math.min(slidingExpiry, absoluteExpiry));
  await client.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: resolvedFamilyId,
      expiresAt: refreshExpiresAt,
    },
  });
  if (isNewFamily) await enforceFamilyCap(client, userId, now);
  return { refreshToken, refreshExpiresAt, familyId: resolvedFamilyId };
}

/** Revokes the least-recently-rotated active families beyond the per-user cap. */
async function enforceFamilyCap(client: Client, userId: string, now: Date): Promise<void> {
  const active = await client.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    select: { familyId: true },
  });
  const families = [...new Set(active.map((r) => r.familyId))];
  const overflow = families.slice(MAX_ACTIVE_FAMILIES_PER_USER);
  if (overflow.length === 0) return;
  await client.refreshToken.updateMany({
    where: { userId, familyId: { in: overflow }, revokedAt: null },
    data: { revokedAt: now, revokedReason: 'family_cap' },
  });
}

async function familyStart(
  tx: Prisma.TransactionClient,
  familyId: string,
  fallback: Date
): Promise<Date> {
  const agg = await tx.refreshToken.aggregate({ where: { familyId }, _min: { createdAt: true } });
  return agg._min.createdAt ?? fallback;
}

async function revokeFamily(
  client: Client,
  familyId: string,
  reason: RevokeReason,
  now: Date
): Promise<void> {
  await client.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
}

const invalid = (): RotationOutcome => ({ ok: false, code: 'REFRESH_TOKEN_INVALID' });

async function rotateInTransaction(
  tx: Prisma.TransactionClient,
  raw: string,
  now: Date
): Promise<RotationOutcome> {
  const tokenHash = hashRefreshToken(raw);
  const row = await tx.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { email: true, isActive: true } } },
  });
  if (!row || row.expiresAt.getTime() <= now.getTime()) return invalid();

  if (!row.user.isActive) {
    await revokeFamily(tx, row.familyId, 'inactive', now);
    logger.warn('Refresh rejected for inactive user', { userId: row.userId, familyId: row.familyId });
    return invalid();
  }

  let current = row;
  if (row.revokedAt === null) {
    const { count } = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'rotated', lastUsedAt: now },
    });
    if (count === 0) {
      const reread = await tx.refreshToken.findUnique({ where: { id: row.id } });
      if (!reread) return invalid();
      current = { ...row, ...reread };
    }
  }

  const wasRotatedByUs = row.revokedAt === null && current.revokedAt === null;
  if (!wasRotatedByUs && !graceAllows(current, now)) {
    return handleRevoked(tx, current, now);
  }

  const startedAt = await familyStart(tx, row.familyId, row.createdAt);
  if (startedAt.getTime() + MAX_FAMILY_DAYS * DAY_MS <= now.getTime()) return invalid();

  const next = await issueRefreshToken(row.userId, row.familyId, tx, now, startedAt);
  return {
    ok: true,
    value: {
      userId: row.userId,
      email: row.user.email,
      refreshToken: next.refreshToken,
      refreshExpiresAt: next.refreshExpiresAt,
    },
  };
}

function graceAllows(
  row: { revokedAt: Date | null; revokedReason: string | null },
  now: Date
): boolean {
  if (row.revokedReason !== 'rotated' || !row.revokedAt) return false;
  const graceMs = config.refreshToken.reuseGraceSeconds * 1000;
  return now.getTime() - row.revokedAt.getTime() <= graceMs;
}

async function handleRevoked(
  tx: Prisma.TransactionClient,
  row: { userId: string; familyId: string; revokedReason: string | null },
  now: Date
): Promise<RotationOutcome> {
  if (row.revokedReason !== 'rotated') return invalid();
  await revokeFamily(tx, row.familyId, 'reuse', now);
  logger.warn('Refresh token reuse detected; family revoked', {
    userId: row.userId,
    familyId: row.familyId,
  });
  return { ok: false, code: 'REFRESH_TOKEN_REUSED' };
}

/**
 * Rotate a refresh token. Failures are decided inside the transaction (so family
 * revocations commit) and thrown after it.
 */
export async function rotateRefreshToken(
  raw: string,
  now: Date = new Date()
): Promise<RotatedRefreshToken> {
  const outcome = await prisma.$transaction((tx) => rotateInTransaction(tx, raw, now));
  if (outcome.ok) return outcome.value;
  throw new AppError(INVALID_MESSAGE, 401, true, { code: outcome.code });
}

export async function revokeFamilyByToken(raw: string, reason: RevokeReason): Promise<void> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(raw) },
    select: { familyId: true },
  });
  if (!row) return;
  await revokeFamily(prisma, row.familyId, reason, new Date());
}

export async function revokeAllForUser(
  userId: string,
  reason: RevokeReason,
  client: Client = prisma
): Promise<void> {
  await client.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}
