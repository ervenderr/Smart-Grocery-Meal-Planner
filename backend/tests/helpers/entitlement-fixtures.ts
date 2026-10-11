/**
 * Test helpers for granting/revoking the one-time unlock directly in the DB.
 */

import { randomInt } from 'crypto';
import { prisma } from '../../src/config/database.config';
import { config } from '../../src/config/env.config';

export interface GrantOptions {
  environment?: 'Sandbox' | 'Production';
  originalTransactionId?: string;
}

export function randomTransactionId(): string {
  // 16 digits: 1-9 followed by 15 random digits (beyond safe-integer range as one number)
  return `${randomInt(1, 10)}${String(randomInt(0, 1e9)).padStart(9, '0')}${String(randomInt(0, 1e6)).padStart(6, '0')}`;
}

export async function grantTestEntitlement(userId: string, opts: GrantOptions = {}): Promise<void> {
  const productId = config.iap.productId;
  const originalTransactionId = opts.originalTransactionId ?? randomTransactionId();
  const now = new Date();
  const data = {
    latestTransactionId: originalTransactionId,
    originalTransactionId,
    environment: opts.environment ?? 'Sandbox',
    status: 'active',
    purchasedAt: now,
    revokedAt: null,
    revocationReason: null,
    lastSignedAt: now,
  };
  await prisma.entitlement.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, ...data },
    update: data,
  });
}

export async function revokeTestEntitlement(userId: string): Promise<void> {
  await prisma.entitlement.updateMany({
    where: { userId, productId: config.iap.productId },
    data: { status: 'revoked', revokedAt: new Date() },
  });
}
