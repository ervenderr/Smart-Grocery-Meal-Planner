/**
 * CR-01: refunds/revocations that arrive before a purchase is claimed are kept
 * as tombstones, so replaying the saved purchase JWS cannot grant access.
 * Real DB, offline test signer.
 */

import { prisma } from '../src/config/database.config';
import {
  setAppleVerifierForTests,
  resetAppleVerifierForTests,
} from '../src/modules/entitlements/entitlements.deps';
import { verifyAndClaim } from '../src/modules/entitlements/entitlements.service';
import { handleAppStoreNotification } from '../src/modules/entitlements/notifications.service';
import { isEntitled } from '../src/modules/entitlements/entitlement-status';
import { signTestNotification, signTestTransaction, testVerifier, TEST_SIGNED_MS } from './helpers/apple-test-signer';
import { randomTransactionId } from './helpers/entitlement-fixtures';

const PREFIX = `ent-tomb-${Date.now()}`;
const DAY_MS = 86_400_000;
const userIds: string[] = [];
const origIds: string[] = [];
const uuids: string[] = [];

const makeUser = async (suffix: string): Promise<string> => {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${suffix}@example.com`, passwordHash: 'x', firstName: 'T', lastName: 'B' },
  });
  userIds.push(user.id);
  return user.id;
};

const newOrig = (): string => {
  const id = randomTransactionId();
  origIds.push(id);
  return id;
};

const notify = (type: string, orig: string, signedDate: number, revoked = true): string => {
  const notificationUUID = `${PREFIX}-${randomTransactionId()}`;
  uuids.push(notificationUUID);
  return signTestNotification({
    notificationType: type,
    notificationUUID,
    signedDate,
    transaction: {
      originalTransactionId: orig,
      transactionId: orig,
      signedDate,
      ...(revoked ? { revocationDate: signedDate, revocationReason: 0 } : {}),
    },
  });
};

/** The original purchase JWS, signed at purchase time (no revocationDate). */
const purchaseJws = (orig: string): string =>
  signTestTransaction({ originalTransactionId: orig, transactionId: orig, signedDate: TEST_SIGNED_MS });

describe('refund tombstones (CR-01)', () => {
  beforeAll(() => setAppleVerifierForTests(testVerifier()));
  afterAll(async () => {
    resetAppleVerifierForTests();
    await prisma.appStoreNotification.deleteMany({ where: { notificationUuid: { in: uuids } } });
    await prisma.appStoreRevocation.deleteMany({ where: { originalTransactionId: { in: origIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('records a REFUND for an unclaimed purchase and a later claim of the saved JWS is revoked', async () => {
    const orig = newOrig();
    expect(await handleAppStoreNotification(notify('REFUND', orig, TEST_SIGNED_MS + DAY_MS))).toBe(
      'no_entitlement',
    );
    const tomb = await prisma.appStoreRevocation.findUnique({
      where: { environment_originalTransactionId: { environment: 'Sandbox', originalTransactionId: orig } },
    });
    expect(tomb?.revokedAt?.getTime()).toBe(TEST_SIGNED_MS + DAY_MS);
    expect(tomb?.lastSignedAt.getTime()).toBe(TEST_SIGNED_MS + DAY_MS);

    const userId = await makeUser('refund-first');
    const view = await verifyAndClaim(userId, purchaseJws(orig));
    expect(view.status).toBe('revoked');
    expect(await isEntitled(userId)).toBe(false);
    const row = await prisma.entitlement.findFirstOrThrow({ where: { userId } });
    expect(row.lastSignedAt.getTime()).toBe(TEST_SIGNED_MS + DAY_MS);
  });

  it('REVOKE also blocks the claim', async () => {
    const orig = newOrig();
    await handleAppStoreNotification(notify('REVOKE', orig, TEST_SIGNED_MS + DAY_MS, false));
    const userId = await makeUser('revoke-first');
    expect((await verifyAndClaim(userId, purchaseJws(orig))).status).toBe('revoked');
  });

  it('REFUND_REVERSED clears the tombstone so the claim is active', async () => {
    const orig = newOrig();
    await handleAppStoreNotification(notify('REFUND', orig, TEST_SIGNED_MS + DAY_MS));
    await handleAppStoreNotification(notify('REFUND_REVERSED', orig, TEST_SIGNED_MS + 2 * DAY_MS));
    const userId = await makeUser('reversed');
    expect((await verifyAndClaim(userId, purchaseJws(orig))).status).toBe('active');
    expect(await isEntitled(userId)).toBe(true);
  });

  it('orders by signedDate: a stale REFUND_REVERSED does not clear a newer REFUND', async () => {
    const orig = newOrig();
    await handleAppStoreNotification(notify('REFUND', orig, TEST_SIGNED_MS + 2 * DAY_MS));
    await handleAppStoreNotification(notify('REFUND_REVERSED', orig, TEST_SIGNED_MS + DAY_MS));
    const userId = await makeUser('stale-reversal');
    expect((await verifyAndClaim(userId, purchaseJws(orig))).status).toBe('revoked');
  });

  it('a stale REFUND does not undo a newer REFUND_REVERSED', async () => {
    const orig = newOrig();
    await handleAppStoreNotification(notify('REFUND_REVERSED', orig, TEST_SIGNED_MS + 2 * DAY_MS));
    await handleAppStoreNotification(notify('REFUND', orig, TEST_SIGNED_MS + DAY_MS));
    const userId = await makeUser('stale-refund');
    expect((await verifyAndClaim(userId, purchaseJws(orig))).status).toBe('active');
  });

  it('a JWS signed after the tombstone wins (e.g. a fresh JWS after reversal)', async () => {
    const orig = newOrig();
    await handleAppStoreNotification(notify('REFUND', orig, TEST_SIGNED_MS + DAY_MS));
    const userId = await makeUser('fresh-jws');
    const fresh = signTestTransaction({
      originalTransactionId: orig,
      transactionId: orig,
      signedDate: TEST_SIGNED_MS + 3 * DAY_MS,
    });
    expect((await verifyAndClaim(userId, fresh)).status).toBe('active');
  });

  it('survives account deletion: a refunded purchase cannot be re-claimed on a new account', async () => {
    const orig = newOrig();
    const first = await makeUser('deleted');
    await verifyAndClaim(first, purchaseJws(orig));
    expect(await handleAppStoreNotification(notify('REFUND', orig, TEST_SIGNED_MS + DAY_MS))).toBe('applied');
    await prisma.entitlement.deleteMany({ where: { userId: first } });

    const second = await makeUser('new-account');
    expect((await verifyAndClaim(second, purchaseJws(orig))).status).toBe('revoked');
    expect(await isEntitled(second)).toBe(false);
  });

  it('tombstones are per environment', async () => {
    const orig = newOrig();
    await handleAppStoreNotification(notify('REFUND', orig, TEST_SIGNED_MS + DAY_MS));
    const userId = await makeUser('env');
    const production = signTestTransaction({
      originalTransactionId: orig,
      transactionId: orig,
      environment: 'Production',
    });
    expect((await verifyAndClaim(userId, production)).status).toBe('active');
  });
});
