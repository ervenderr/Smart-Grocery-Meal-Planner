/**
 * App Store Server Notifications V2 (12-09, SUB-02): service + public webhook route.
 * Real DB, offline test signer.
 */

import { prisma } from '../src/config/database.config';
import { AppError } from '../src/middleware/errorHandler';
import {
  setAppleVerifierForTests,
  resetAppleVerifierForTests,
} from '../src/modules/entitlements/entitlements.deps';
import * as entitlementsService from '../src/modules/entitlements/entitlements.service';
import { handleAppStoreNotification } from '../src/modules/entitlements/notifications.service';
import { isEntitled } from '../src/modules/entitlements/entitlement-status';
import { AppleVerificationError, type AppleVerifier } from '../src/modules/entitlements/apple-verifier';
import { signTestNotification, testVerifier, TEST_SIGNED_MS } from './helpers/apple-test-signer';
import { grantTestEntitlement, randomTransactionId } from './helpers/entitlement-fixtures';

const PREFIX = `asn-${Date.now()}`;
const userIds: string[] = [];
const notificationIds: string[] = [];

const DAY_MS = 86_400_000;

const makeUser = async (suffix: string): Promise<string> => {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${suffix}@example.com`, passwordHash: 'x', firstName: 'A', lastName: 'S' },
  });
  userIds.push(user.id);
  return user.id;
};

const uuid = (): string => {
  const id = `${PREFIX}-${randomTransactionId()}`;
  notificationIds.push(id);
  return id;
};

const notify = (
  type: string,
  orig: string,
  extra: {
    environment?: 'Sandbox' | 'Production';
    signedDate?: number;
    notificationUUID?: string;
    withRevocation?: boolean;
    withoutTransaction?: boolean;
  } = {},
): string =>
  signTestNotification({
    notificationType: type,
    notificationUUID: extra.notificationUUID ?? uuid(),
    signedDate: extra.signedDate,
    environment: extra.environment,
    withoutTransaction: extra.withoutTransaction,
    transaction: {
      originalTransactionId: orig,
      transactionId: orig,
      ...(extra.withRevocation === false ? {} : { revocationDate: TEST_SIGNED_MS, revocationReason: 0 }),
    },
  });

const cleanup = async (): Promise<void> => {
  await prisma.appStoreNotification.deleteMany({ where: { notificationUuid: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
};

describe('notifications.service', () => {
  beforeAll(() => setAppleVerifierForTests(testVerifier()));
  afterAll(async () => {
    resetAppleVerifierForTests();
    await cleanup();
  });

  const rowOf = (userId: string) => prisma.entitlement.findFirst({ where: { userId } });

  it('REFUND revokes the entitlement', async () => {
    const userId = await makeUser('refund');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });
    expect(await isEntitled(userId)).toBe(true);

    expect(await handleAppStoreNotification(notify('REFUND', orig))).toBe('applied');
    const row = await rowOf(userId);
    expect(row?.status).toBe('revoked');
    expect(row?.revokedAt?.getTime()).toBe(TEST_SIGNED_MS);
    expect(await isEntitled(userId)).toBe(false);
  });

  it('REVOKE behaves like REFUND, even without a revocationDate in the payload', async () => {
    const userId = await makeUser('revoke');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });

    expect(await handleAppStoreNotification(notify('REVOKE', orig, { withRevocation: false }))).toBe('applied');
    const row = await rowOf(userId);
    expect(row?.status).toBe('revoked');
    expect(row?.revokedAt).not.toBeNull();
  });

  it('REFUND_REVERSED re-activates after a REFUND, even if the payload still carries revocationDate', async () => {
    const userId = await makeUser('reversed');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });
    await handleAppStoreNotification(notify('REFUND', orig));

    const later = TEST_SIGNED_MS + DAY_MS;
    expect(await handleAppStoreNotification(notify('REFUND_REVERSED', orig, { signedDate: later }))).toBe('applied');
    const row = await rowOf(userId);
    expect(row?.status).toBe('active');
    expect(row?.revokedAt).toBeNull();
    expect(await isEntitled(userId)).toBe(true);
  });

  it('ONE_TIME_CHARGE refreshes an existing row', async () => {
    const userId = await makeUser('charge');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });

    const outcome = await handleAppStoreNotification(notify('ONE_TIME_CHARGE', orig, { withRevocation: false }));
    expect(outcome).toBe('applied');
    const row = await rowOf(userId);
    expect(row?.status).toBe('active');
    expect(row?.lastSignedAt.getTime()).toBe(TEST_SIGNED_MS);
  });

  it('treats the same notificationUUID as a no-op duplicate', async () => {
    const userId = await makeUser('dupe');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });
    const id = uuid();

    expect(await handleAppStoreNotification(notify('REFUND', orig, { notificationUUID: id }))).toBe('applied');
    // Restore directly, then replay: the replay must not revoke again.
    await grantTestEntitlement(userId, { originalTransactionId: orig });
    expect(await handleAppStoreNotification(notify('REFUND', orig, { notificationUUID: id }))).toBe('duplicate');
    expect((await rowOf(userId))?.status).toBe('active');
  });

  it('ignores a notification older than lastSignedAt but records its UUID', async () => {
    const userId = await makeUser('stale');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });
    await handleAppStoreNotification(notify('REFUND', orig)); // lastSignedAt = TEST_SIGNED_MS

    const id = uuid();
    const stale = notify('REFUND_REVERSED', orig, { notificationUUID: id, signedDate: TEST_SIGNED_MS - DAY_MS });
    expect(await handleAppStoreNotification(stale)).toBe('ignored');
    expect((await rowOf(userId))?.status).toBe('revoked');
    expect(await prisma.appStoreNotification.findUnique({ where: { notificationUuid: id } })).not.toBeNull();
  });

  it('returns no_entitlement for an unknown originalTransactionId and records the UUID', async () => {
    const id = uuid();
    const outcome = await handleAppStoreNotification(
      notify('REFUND', randomTransactionId(), { notificationUUID: id }),
    );
    expect(outcome).toBe('no_entitlement');
    expect(await prisma.appStoreNotification.findUnique({ where: { notificationUuid: id } })).not.toBeNull();
  });

  it('ignores TEST notifications (no transaction) and unknown types', async () => {
    const test = signTestNotification({
      notificationType: 'TEST',
      notificationUUID: uuid(),
      withoutTransaction: true,
    });
    expect(await handleAppStoreNotification(test)).toBe('ignored');

    const userId = await makeUser('unknown');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });
    expect(await handleAppStoreNotification(notify('SOMETHING_NEW', orig))).toBe('ignored');
    expect((await rowOf(userId))?.status).toBe('active');
  });

  it('never lets a Sandbox notification modify a Production row', async () => {
    const userId = await makeUser('env');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig, environment: 'Production' });

    const outcome = await handleAppStoreNotification(notify('REFUND', orig, { environment: 'Sandbox' }));
    expect(outcome).toBe('no_entitlement');
    expect((await rowOf(userId))?.status).toBe('active');
  });

  it('rolls back the dedupe row when the entitlement update fails so a retry is processed', async () => {
    const userId = await makeUser('rollback');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });
    const id = uuid();
    const payload = notify('REFUND', orig, { notificationUUID: id });

    const spy = jest.spyOn(entitlementsService, 'applyVerifiedTransaction').mockRejectedValueOnce(new Error('db down'));
    await expect(handleAppStoreNotification(payload)).rejects.toBeDefined();
    spy.mockRestore();

    expect(await prisma.appStoreNotification.findUnique({ where: { notificationUuid: id } })).toBeNull();
    expect(await handleAppStoreNotification(payload)).toBe('applied');
    expect((await rowOf(userId))?.status).toBe('revoked');
  });

  it('maps verification failures to 400 and retryable ones to 503', async () => {
    const mk = (kind: 'invalid' | 'retryable' | 'not_configured'): AppleVerifier => ({
      verifyTransaction: () => Promise.reject(new AppleVerificationError(kind)),
      verifyNotification: () => Promise.reject(new AppleVerificationError(kind)),
    });
    const statusOf = async (kind: 'invalid' | 'retryable' | 'not_configured'): Promise<number> => {
      setAppleVerifierForTests(mk(kind));
      const err = await handleAppStoreNotification('x.y.z').then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(AppError);
      return (err as AppError).statusCode;
    };
    try {
      expect(await statusOf('invalid')).toBe(400);
      expect(await statusOf('not_configured')).toBe(400);
      expect(await statusOf('retryable')).toBe(503);
    } finally {
      setAppleVerifierForTests(testVerifier());
    }
  });
});
