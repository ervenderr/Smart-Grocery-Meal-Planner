/**
 * Atomic UTC-day AI quota. Each reserve is one INSERT ... ON CONFLICT DO UPDATE
 * ... WHERE count < limit RETURNING statement; the user statement runs in the
 * same transaction so a rejected user reserve rolls back the global increment.
 * Tagged templates only (parameterized).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.config';

export type QuotaScope = 'user' | 'global';

export class QuotaExceededError extends Error {
  constructor(
    public readonly scope: QuotaScope,
    public readonly limit: number
  ) {
    super(`AI ${scope} quota exceeded`);
    this.name = 'QuotaExceededError';
  }
}

export interface ReserveInput {
  readonly userId: string;
  readonly day: string;
  readonly userLimit: number;
  readonly globalLimit: number;
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function nextUtcMidnight(now: Date): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return new Date(next).toISOString();
}

async function increment(
  tx: Prisma.TransactionClient,
  scope: string,
  day: string,
  limit: number
): Promise<number | null> {
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    INSERT INTO ai_usage (scope, day, count, updated_at)
    VALUES (${scope}, ${day}::date, 1, now())
    ON CONFLICT (scope, day) DO UPDATE
      SET count = ai_usage.count + 1, updated_at = now()
      WHERE ai_usage.count < ${limit}
    RETURNING count`;
  return rows.length === 0 ? null : Number(rows[0].count);
}

export async function reserveQuota(
  input: ReserveInput
): Promise<{ userCount: number; globalCount: number }> {
  const { userId, day, userLimit, globalLimit } = input;
  return prisma.$transaction(async (tx) => {
    const globalCount = await increment(tx, 'global', day, globalLimit);
    if (globalCount === null) throw new QuotaExceededError('global', globalLimit);
    const userCount = await increment(tx, `user:${userId}`, day, userLimit);
    if (userCount === null) throw new QuotaExceededError('user', userLimit);
    return { userCount, globalCount };
  });
}

export async function refundQuota(input: { userId: string; day: string }): Promise<void> {
  const userScope = `user:${input.userId}`;
  await prisma.$executeRaw`
    UPDATE ai_usage SET count = GREATEST(count - 1, 0), updated_at = now()
    WHERE scope IN ('global', ${userScope}) AND day = ${input.day}::date`;
}

export async function pruneOldUsage(now: Date, keepDays: number): Promise<number> {
  const cutoff = utcDay(new Date(now.getTime() - keepDays * 86_400_000));
  return prisma.$executeRaw`DELETE FROM ai_usage WHERE day < ${cutoff}::date`;
}
