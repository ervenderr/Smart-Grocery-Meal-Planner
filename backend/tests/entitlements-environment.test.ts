/**
 * WR-01: a free Sandbox (TestFlight) purchase must never replace or re-activate
 * a Production entitlement. Real DB, offline test signer.
 */

import { prisma } from '../src/config/database.config';
import {
  setAppleVerifierForTests,
  resetAppleVerifierForTests,
} from '../src/modules/entitlements/entitlements.deps';
import { verifyAndClaim } from '../src/modules/entitlements/entitlements.service';
import { isEntitled } from '../src/modules/entitlements/entitlement-status';
import { signTestTransaction, testVerifier, TEST_SIGNED_MS } from './helpers/apple-test-signer';
import { randomTransactionId } from './helpers/entitlement-fixtures';

const PREFIX = `ent-env-${Date.now()}`;
const userIds: string[] = [];

const makeUser = async (suffix: string): Promise<string> => {
  const user = await prisma.user.create({
    data: { email: `${PREFIX}-${suffix}@example.com`, passwordHash: 'x', firstName: 'E', lastName: 'N' },
  });
  userIds.push(user.id);
  return user.id;
};

const jws = (environment: 'Sandbox' | 'Production', extra: Record<string, number> = {}): string => {
  const id = randomTransactionId();
  return signTestTransaction({ originalTransactionId: id, transactionId: id, environment, ...extra });
};

const rowOf = (userId: string) => prisma.entitlement.findFirstOrThrow({ where: { userId } });

describe('Sandbox vs Production entitlements (WR-01)', () => {
  beforeAll(() => setAppleVerifierForTests(testVerifier()));
  afterAll(async () => {
    resetAppleVerifierForTests();
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('a Sandbox purchase cannot re-activate a refunded Production entitlement', async () => {
    const userId = await makeUser('refunded-prod');
    await verifyAndClaim(
      userId,
      jws('Production', { revocationDate: TEST_SIGNED_MS, revocationReason: 0 }),
    );
    expect((await rowOf(userId)).status).toBe('revoked');

    const view = await verifyAndClaim(userId, jws('Sandbox', { signedDate: TEST_SIGNED_MS + 5000 }));
    expect(view).toMatchObject({ status: 'revoked', environment: 'Production' });
    expect((await rowOf(userId)).environment).toBe('Production');
    expect(await isEntitled(userId)).toBe(false);
  });

  it('a Sandbox purchase does not overwrite an active Production entitlement', async () => {
    const userId = await makeUser('active-prod');
    await verifyAndClaim(userId, jws('Production'));
    const view = await verifyAndClaim(userId, jws('Sandbox', { signedDate: TEST_SIGNED_MS + 5000 }));
    expect(view).toMatchObject({ status: 'active', environment: 'Production' });
  });

  it('a Production purchase supersedes an active Sandbox entitlement', async () => {
    const userId = await makeUser('sandbox-then-prod');
    await verifyAndClaim(userId, jws('Sandbox'));
    const view = await verifyAndClaim(userId, jws('Production', { signedDate: TEST_SIGNED_MS + 5000 }));
    expect(view).toMatchObject({ status: 'active', environment: 'Production' });
    expect((await rowOf(userId)).environment).toBe('Production');
  });

  it('a different Sandbox purchase still replaces a revoked Sandbox row (tester flow)', async () => {
    const userId = await makeUser('sandbox-retry');
    await verifyAndClaim(userId, jws('Sandbox', { revocationDate: TEST_SIGNED_MS, revocationReason: 0 }));
    const view = await verifyAndClaim(userId, jws('Sandbox', { signedDate: TEST_SIGNED_MS + 5000 }));
    expect(view.status).toBe('active');
  });
});
