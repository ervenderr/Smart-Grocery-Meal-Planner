/**
 * Entitlement verify/claim service (12-06, SUB-01/SUB-02), real DB, offline test signer.
 */

import { prisma } from '../src/config/database.config';
import { AppError } from '../src/middleware/errorHandler';
import {
  setAppleVerifierForTests,
  resetAppleVerifierForTests,
} from '../src/modules/entitlements/entitlements.deps';
import { verifyAndClaim, getMe } from '../src/modules/entitlements/entitlements.service';
import type { AppleVerifier } from '../src/modules/entitlements/apple-verifier';
import { AppleVerificationError } from '../src/modules/entitlements/apple-verifier';
import {
  signTestTransaction,
  testVerifier,
  TEST_SIGNED_MS,
} from './helpers/apple-test-signer';
import { randomTransactionId } from './helpers/entitlement-fixtures';

const PREFIX = `ent-claim-${Date.now()}`;
const userIds: string[] = [];

const makeUser = async (suffix: string): Promise<string> => {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}-${suffix}@example.com`,
      passwordHash: 'x',
      firstName: 'Ent',
      lastName: 'Claim',
    },
  });
  userIds.push(user.id);
  return user.id;
};

const expectAppError = async (p: Promise<unknown>, status: number, code: string) => {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).statusCode).toBe(status);
  expect((err as AppError).code).toBe(code);
};

describe('entitlements service', () => {
  beforeAll(() => setAppleVerifierForTests(testVerifier()));
  afterAll(async () => {
    resetAppleVerifierForTests();
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('stores one active row for a valid transaction', async () => {
    const userId = await makeUser('a');
    const orig = randomTransactionId();
    const view = await verifyAndClaim(
      userId,
      signTestTransaction({ originalTransactionId: orig, transactionId: orig }),
    );
    expect(view).toMatchObject({
      status: 'active',
      productId: 'app.kitcha.mobile.full',
      environment: 'Sandbox',
    });
    const rows = await prisma.entitlement.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      originalTransactionId: orig,
      latestTransactionId: orig,
      status: 'active',
      environment: 'Sandbox',
    });
    expect(rows[0].lastSignedAt.getTime()).toBe(TEST_SIGNED_MS);
  });

  it('updates latest transaction for a newer one and ignores older signedDate', async () => {
    const userId = await makeUser('b');
    const orig = randomTransactionId();
    const t2 = randomTransactionId();
    const t3 = randomTransactionId();
    await verifyAndClaim(userId, signTestTransaction({ originalTransactionId: orig, transactionId: orig }));
    await verifyAndClaim(
      userId,
      signTestTransaction({ originalTransactionId: orig, transactionId: t2, signedDate: TEST_SIGNED_MS + 5000 }),
    );
    let row = await prisma.entitlement.findFirstOrThrow({ where: { userId } });
    expect(row.latestTransactionId).toBe(t2);

    // Older revoked JWS must not downgrade
    const view = await verifyAndClaim(
      userId,
      signTestTransaction({
        originalTransactionId: orig,
        transactionId: t3,
        signedDate: TEST_SIGNED_MS + 1000,
        revocationDate: TEST_SIGNED_MS + 900,
        revocationReason: 0,
      }),
    );
    expect(view.status).toBe('active');
    row = await prisma.entitlement.findFirstOrThrow({ where: { userId } });
    expect(row.status).toBe('active');
    expect(row.latestTransactionId).toBe(t2);
  });

  it('stores revoked status with reason, and re-activates on a newer clean JWS', async () => {
    const userId = await makeUser('c');
    const orig = randomTransactionId();
    const view = await verifyAndClaim(
      userId,
      signTestTransaction({
        originalTransactionId: orig,
        transactionId: orig,
        revocationDate: TEST_SIGNED_MS,
        revocationReason: 1,
      }),
    );
    expect(view.status).toBe('revoked');
    let row = await prisma.entitlement.findFirstOrThrow({ where: { userId } });
    expect(row.status).toBe('revoked');
    expect(row.revokedAt).not.toBeNull();
    expect(row.revocationReason).toBe(1);

    const again = await verifyAndClaim(
      userId,
      signTestTransaction({
        originalTransactionId: orig,
        transactionId: randomTransactionId(),
        signedDate: TEST_SIGNED_MS + 10_000,
      }),
    );
    expect(again.status).toBe('active');
    row = await prisma.entitlement.findFirstOrThrow({ where: { userId } });
    expect(row.revokedAt).toBeNull();
    expect(row.revocationReason).toBeNull();
  });

  it('rejects a second user claiming the same original transaction', async () => {
    const u1 = await makeUser('d1');
    const u2 = await makeUser('d2');
    const orig = randomTransactionId();
    const jws = signTestTransaction({ originalTransactionId: orig, transactionId: orig });
    await verifyAndClaim(u1, jws);
    await expectAppError(verifyAndClaim(u2, jws), 409, 'ENTITLEMENT_ALREADY_CLAIMED');
    expect(await prisma.entitlement.count({ where: { userId: u2 } })).toBe(0);
    expect(await prisma.entitlement.count({ where: { userId: u1 } })).toBe(1);
  });

  it('lets exactly one of two concurrent claimants win', async () => {
    const u1 = await makeUser('e1');
    const u2 = await makeUser('e2');
    const orig = randomTransactionId();
    const jws = signTestTransaction({ originalTransactionId: orig, transactionId: orig });
    const results = await Promise.allSettled([verifyAndClaim(u1, jws), verifyAndClaim(u2, jws)]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(AppError);
    expect((failed[0].reason as AppError).statusCode).toBe(409);
    expect((failed[0].reason as AppError).code).toBe('ENTITLEMENT_ALREADY_CLAIMED');
    expect(await prisma.entitlement.count({ where: { originalTransactionId: orig } })).toBe(1);
  });

  it('rejects wrong product and non Non-Consumable type', async () => {
    const userId = await makeUser('f');
    await expectAppError(
      verifyAndClaim(userId, signTestTransaction({ productId: 'app.kitcha.mobile.other' })),
      400,
      'INVALID_TRANSACTION',
    );
    await expectAppError(
      verifyAndClaim(userId, signTestTransaction({ type: 'Consumable' })),
      400,
      'INVALID_TRANSACTION',
    );
    expect(await prisma.entitlement.count({ where: { userId } })).toBe(0);
  });

  it('rejects wrong bundle and tampered JWS as invalid', async () => {
    const userId = await makeUser('g');
    await expectAppError(
      verifyAndClaim(userId, signTestTransaction({ bundleId: 'com.evil.app' })),
      400,
      'INVALID_TRANSACTION',
    );
    const jws = signTestTransaction();
    const [h, p, s] = jws.split('.');
    const tampered = `${h}.${p.slice(0, -2)}AA.${s}`;
    await expectAppError(verifyAndClaim(userId, tampered), 400, 'INVALID_TRANSACTION');
  });

  it.each([
    ['retryable', 503, 'VERIFICATION_UNAVAILABLE'],
    ['not_configured', 503, 'IAP_NOT_CONFIGURED'],
    ['invalid', 400, 'INVALID_TRANSACTION'],
  ] as const)('maps verifier kind %s to %i %s without leaking details', async (kind, status, code) => {
    const stub: AppleVerifier = {
      verifyTransaction: () => Promise.reject(new AppleVerificationError(kind)),
      verifyNotification: () => Promise.reject(new AppleVerificationError(kind)),
    };
    setAppleVerifierForTests(stub);
    try {
      const userId = await makeUser(`h-${kind}`);
      const err = await verifyAndClaim(userId, 'secret.jws.value-should-not-leak').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(status);
      expect((err as AppError).code).toBe(code);
      expect((err as AppError).message).not.toContain('secret');
    } finally {
      setAppleVerifierForTests(testVerifier());
    }
  });

  it('getMe reports limits for none, active and revoked', async () => {
    const userId = await makeUser('i');
    expect(await getMe(userId)).toMatchObject({
      status: 'none',
      environment: null,
      purchasedAt: null,
      limits: { pantry: 25, aiDaily: 20, aiMonthly: null },
    });

    const orig = randomTransactionId();
    await verifyAndClaim(userId, signTestTransaction({ originalTransactionId: orig, transactionId: orig }));
    const active = await getMe(userId);
    expect(active.status).toBe('active');
    expect(active.limits).toEqual({ pantry: null, aiDaily: 40, aiMonthly: 600 });
    expect(typeof active.purchasedAt).toBe('string');

    await verifyAndClaim(
      userId,
      signTestTransaction({
        originalTransactionId: orig,
        transactionId: randomTransactionId(),
        signedDate: TEST_SIGNED_MS + 1000,
        revocationDate: TEST_SIGNED_MS + 900,
      }),
    );
    const revoked = await getMe(userId);
    expect(revoked.status).toBe('revoked');
    expect(revoked.limits).toEqual({ pantry: 25, aiDaily: 20, aiMonthly: null });
    expect(typeof revoked.revokedAt).toBe('string');
  });
});
