/**
 * App Store Server Notifications V2 (12-09, SUB-02): service + public webhook route.
 * Real DB, offline test signer.
 */

import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { httpsRedirect } from '../src/middleware/httpsRedirect';
import notificationRoutes from '../src/modules/entitlements/notifications.routes';
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

describe('POST /api/v1/webhooks/app-store', () => {
  const app = createApp();
  const URL = '/api/v1/webhooks/app-store';
  const post = (body: unknown) => request(app).post(URL).send(body as object);

  beforeAll(() => setAppleVerifierForTests(testVerifier()));
  afterAll(async () => {
    resetAppleVerifierForTests();
    await cleanup();
  });

  it('revokes on a signed REFUND with no Origin and no Authorization header', async () => {
    const userId = await makeUser('http-refund');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });

    const res = await post({ signedPayload: notify('REFUND', orig) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
    expect(await isEntitled(userId)).toBe(false);
  });

  it('returns 400 for a missing, non-string or oversized signedPayload', async () => {
    await post({}).expect(400);
    await post({ signedPayload: 1234567890123456 }).expect(400);
    await post({ signedPayload: 'short' }).expect(400);
    await post({ signedPayload: 'a'.repeat(65537) }).expect(400);
  });

  it('returns 400 and changes nothing for a payload signed by an untrusted chain', async () => {
    const userId = await makeUser('http-untrusted');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });
    // Verifier that trusts no known root rejects the otherwise valid test-signed payload.
    setAppleVerifierForTests(testVerifier({ rootCertificates: [Buffer.from('not-a-root')] }));
    try {
      const res = await post({ signedPayload: notify('REFUND', orig) });
      expect(res.status).toBe(400);
    } finally {
      setAppleVerifierForTests(testVerifier());
    }
    expect(await isEntitled(userId)).toBe(true);
  });

  it('returns 200 for a duplicate notification', async () => {
    const orig = randomTransactionId();
    const payload = notify('REFUND', orig, { notificationUUID: uuid() });
    await post({ signedPayload: payload }).expect(200);
    await post({ signedPayload: payload }).expect(200);
  });

  it('returns 500 when the database fails so Apple retries', async () => {
    const spy = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('db down'));
    try {
      const res = await post({ signedPayload: notify('REFUND', randomTransactionId()) });
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  it('is not redirected by httpsRedirect when Apple calls the https URL (production wiring)', async () => {
    const userId = await makeUser('http-https');
    const orig = randomTransactionId();
    await grantTestEntitlement(userId, { originalTransactionId: orig });

    const prod = express();
    prod.set('trust proxy', 2);
    prod.use(httpsRedirect('api.example.com'));
    prod.use(express.json({ limit: '1mb' }));
    prod.use(URL, notificationRoutes);

    const body = { signedPayload: notify('REFUND', orig) };
    const secure = await request(prod)
      .post(URL)
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.7')
      .send(body);
    expect(secure.status).toBe(200);
    expect(await isEntitled(userId)).toBe(false);
    // Plain http would be redirected (Apple does not follow), which is why the https URL is registered.
    const plain = await request(prod).post(URL).send(body);
    expect(plain.status).toBe(308);
  });
});
