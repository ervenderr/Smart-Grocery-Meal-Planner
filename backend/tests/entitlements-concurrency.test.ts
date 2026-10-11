/**
 * WR-02: claim (/verify) and the App Store webhook serialize on the purchase,
 * so a pre-refund JWS can never undo a concurrent REFUND. Real DB.
 */

import { prisma } from '../src/config/database.config';
import {
  setAppleVerifierForTests,
  resetAppleVerifierForTests,
} from '../src/modules/entitlements/entitlements.deps';
import { verifyAndClaim } from '../src/modules/entitlements/entitlements.service';
import { handleAppStoreNotification } from '../src/modules/entitlements/notifications.service';
import { lockPurchase } from '../src/modules/entitlements/entitlement-lock';
import { signTestNotification, signTestTransaction, testVerifier, TEST_SIGNED_MS } from './helpers/apple-test-signer';
import { randomTransactionId } from './helpers/entitlement-fixtures';

const PREFIX = `ent-conc-${Date.now()}`;
const DAY_MS = 86_400_000;
const userIds: string[] = [];
const origIds: string[] = [];
const uuids: string[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const makeUser = async (suffix: string): Promise<string> => {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${suffix}@example.com`, passwordHash: 'x', firstName: 'C', lastName: 'C' },
  });
  userIds.push(user.id);
  return user.id;
};

const newOrig = (): string => {
  const id = randomTransactionId();
  origIds.push(id);
  return id;
};

const refund = (orig: string, signedDate: number): string => {
  const notificationUUID = `${PREFIX}-${randomTransactionId()}`;
  uuids.push(notificationUUID);
  return signTestNotification({
    notificationType: 'REFUND',
    notificationUUID,
    signedDate,
    transaction: { originalTransactionId: orig, transactionId: orig, revocationDate: signedDate, revocationReason: 0 },
  });
};

describe('entitlement update serialization (WR-02)', () => {
  beforeAll(() => setAppleVerifierForTests(testVerifier()));
  afterAll(async () => {
    resetAppleVerifierForTests();
    await prisma.appStoreNotification.deleteMany({ where: { notificationUuid: { in: uuids } } });
    await prisma.appStoreRevocation.deleteMany({ where: { originalTransactionId: { in: origIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('a claim waits while another transaction holds the purchase lock', async () => {
    const orig = newOrig();
    const userId = await makeUser('wait');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const holder = prisma.$transaction(
      async (tx) => {
        await lockPurchase(tx, 'Sandbox', orig);
        await gate;
      },
      { timeout: 10_000 },
    );
    await sleep(100);

    let done = false;
    const claim = verifyAndClaim(
      userId,
      signTestTransaction({ originalTransactionId: orig, transactionId: orig }),
    ).then((v) => {
      done = true;
      return v;
    });
    await sleep(300);
    expect(done).toBe(false);

    release();
    await holder;
    expect((await claim).status).toBe('active');
    expect(done).toBe(true);
  });

  it('a concurrent REFUND and an older-JWS verify always end revoked', async () => {
    for (let i = 0; i < 8; i += 1) {
      const orig = newOrig();
      const userId = await makeUser(`race-${i}`);
      await verifyAndClaim(userId, signTestTransaction({ originalTransactionId: orig, transactionId: orig }));

      const preRefundJws = signTestTransaction({
        originalTransactionId: orig,
        transactionId: orig,
        signedDate: TEST_SIGNED_MS + 1000,
      });
      await Promise.all([
        handleAppStoreNotification(refund(orig, TEST_SIGNED_MS + DAY_MS)),
        verifyAndClaim(userId, preRefundJws),
      ]);
      const row = await prisma.entitlement.findFirstOrThrow({ where: { userId } });
      expect(row.status).toBe('revoked');
      expect(row.lastSignedAt.getTime()).toBe(TEST_SIGNED_MS + DAY_MS);
    }
  });
});
