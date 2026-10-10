/**
 * Persistence for idempotency_keys. Tagged raw SQL only (never *Unsafe).
 */

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database.config';
import { config } from '@/config/env.config';
import { AppError } from '@/middleware/errorHandler';
import { IDEMPOTENCY_STATUS } from './idempotency.constants';

export interface ReserveInput {
  readonly userId: string;
  readonly key: string;
  readonly method: string;
  readonly route: string;
  readonly requestHash: string;
  readonly now: Date;
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + config.idempotency.ttlHours * 3_600_000);
}

/** Returns the new row id when we own the key, null when it already exists. */
export async function reserve(input: ReserveInput): Promise<string | null> {
  const { userId, key, method, route, requestHash, now } = input;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO idempotency_keys
        (id, user_id, key, method, route, request_hash, status, expires_at, created_at)
      VALUES
        (${randomUUID()}, ${userId}, ${key}, ${method}, ${route}, ${requestHash},
         ${IDEMPOTENCY_STATUS.IN_PROGRESS}, ${expiryFrom(now)}, ${now})
      ON CONFLICT (user_id, key) DO NOTHING
      RETURNING id`;
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = (error as Error).message ?? '';
    if (code === 'P2003' || message.includes('foreign key constraint')) {
      throw new AppError('Authentication required', 401);
    }
    throw error;
  }
}

export function findByUserKey(userId: string, key: string) {
  return prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } });
}

export interface TakeOverFields {
  readonly method: string;
  readonly route: string;
  readonly requestHash: string;
  readonly now: Date;
}

/** Conditionally re-claims an expired/stale row; false when a concurrent claimer won. */
export async function takeOver(
  existingId: string,
  expectedCreatedAt: Date,
  fields: TakeOverFields
): Promise<boolean> {
  const result = await prisma.idempotencyKey.updateMany({
    where: { id: existingId, createdAt: expectedCreatedAt },
    data: {
      status: IDEMPOTENCY_STATUS.IN_PROGRESS,
      requestHash: fields.requestHash,
      method: fields.method,
      route: fields.route,
      responseStatus: null,
      responseBody: Prisma.DbNull,
      createdAt: fields.now,
      expiresAt: expiryFrom(fields.now),
    },
  });
  return result.count === 1;
}

export async function complete(
  id: string,
  responseStatus: number,
  responseBody: Prisma.InputJsonValue
): Promise<void> {
  await prisma.idempotencyKey.update({
    where: { id },
    data: { status: IDEMPOTENCY_STATUS.COMPLETED, responseStatus, responseBody },
  });
}

export async function release(id: string): Promise<void> {
  await prisma.idempotencyKey.deleteMany({
    where: { id, status: IDEMPOTENCY_STATUS.IN_PROGRESS },
  });
}
