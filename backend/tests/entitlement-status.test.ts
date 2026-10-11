/**
 * Entitlement status reader + schema constraints.
 */

import { randomUUID } from 'crypto';
import { prisma } from '../src/config/database.config';
import { config } from '../src/config/env.config';
import { getEntitlementSummary, isEntitled } from '../src/modules/entitlements/entitlement-status';
import {
  grantTestEntitlement,
  randomTransactionId,
  revokeTestEntitlement,
} from './helpers/entitlement-fixtures';

const TAG = `entstat-${Date.now()}`;
const userIds: string[] = [];

async function makeUser(label: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `${TAG}-${label}-${randomUUID().slice(0, 6)}@example.com`,
      passwordHash: 'x',
      firstName: 'Ent',
      lastName: label,
    },
  });
  userIds.push(user.id);
  return user.id;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe('isEntitled / getEntitlementSummary', () => {
  it('is false with no row and summary is none', async () => {
    const id = await makeUser('none');
    expect(await isEntitled(id)).toBe(false);
    expect(await getEntitlementSummary(id)).toEqual({
      status: 'none',
      productId: config.iap.productId,
      environment: null,
      purchasedAt: null,
      revokedAt: null,
    });
  });

  it('is true for an active row of the configured product', async () => {
    const id = await makeUser('active');
    await grantTestEntitlement(id);
    expect(await isEntitled(id)).toBe(true);
    const summary = await getEntitlementSummary(id);
    expect(summary.status).toBe('active');
    expect(summary.environment).toBe('Sandbox');
    expect(summary.purchasedAt).toBeInstanceOf(Date);
    expect(summary.revokedAt).toBeNull();
  });

  it('is false once revoked and summary exposes revokedAt', async () => {
    const id = await makeUser('revoked');
    await grantTestEntitlement(id);
    await revokeTestEntitlement(id);
    expect(await isEntitled(id)).toBe(false);
    const summary = await getEntitlementSummary(id);
    expect(summary.status).toBe('revoked');
    expect(summary.revokedAt).toBeInstanceOf(Date);
  });

  it('is false for an active row of a different product', async () => {
    const id = await makeUser('other');
    await grantTestEntitlement(id);
    await prisma.entitlement.updateMany({
      where: { userId: id },
      data: { productId: 'app.kitcha.mobile.other' },
    });
    expect(await isEntitled(id)).toBe(false);
  });

  it('works inside a transaction client', async () => {
    const id = await makeUser('tx');
    await grantTestEntitlement(id);
    const result = await prisma.$transaction((tx) => isEntitled(id, tx));
    expect(result).toBe(true);
  });
});

describe('entitlements unique constraints', () => {
  it('rejects the same (environment, originalTransactionId) for another user', async () => {
    const [a, b] = [await makeUser('ua'), await makeUser('ub')];
    const originalTransactionId = randomTransactionId();
    await grantTestEntitlement(a, { originalTransactionId });
    await expect(grantTestEntitlement(b, { originalTransactionId })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows the same originalTransactionId in Sandbox and Production', async () => {
    const [a, b] = [await makeUser('sa'), await makeUser('sb')];
    const originalTransactionId = randomTransactionId();
    await grantTestEntitlement(a, { originalTransactionId, environment: 'Sandbox' });
    await expect(
      grantTestEntitlement(b, { originalTransactionId, environment: 'Production' })
    ).resolves.toBeUndefined();
  });
});
