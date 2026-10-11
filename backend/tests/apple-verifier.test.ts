import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { VerificationException, VerificationStatus } from '@apple/app-store-server-library';
import { AppleVerificationError } from '../src/modules/entitlements/apple-verifier';
import {
  TEST_BUNDLE_ID,
  TEST_PRODUCT_ID,
  signTestNotification,
  signTestTransaction,
  signWithChain,
  testVerifier,
} from './helpers/apple-test-signer';

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppleVerificationError) return e.kind;
    throw e;
  }
  return 'resolved';
}

function tamper(jws: string): string {
  const [h, p, s] = jws.split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  payload.productId = 'app.kitcha.mobile.other';
  return [h, Buffer.from(JSON.stringify(payload)).toString('base64url'), s].join('.');
}

describe('createAppleVerifier', () => {
  it('verifies a Sandbox transaction signed by the test PKI', async () => {
    const jws = signTestTransaction({ revocationDate: undefined });
    const tx = await testVerifier().verifyTransaction(jws);
    expect(tx.environment).toBe('Sandbox');
    expect(tx.productId).toBe(TEST_PRODUCT_ID);
    expect(tx.bundleId).toBe(TEST_BUNDLE_ID);
    expect(typeof tx.transactionId).toBe('string');
    expect(tx.purchaseDate).toBeInstanceOf(Date);
    expect(tx.signedDate).toBeInstanceOf(Date);
    expect(tx.revocationDate).toBeNull();
    expect(tx.revocationReason).toBeNull();
    expect(Object.isFrozen(tx)).toBe(true);
  });

  it('rejects a tampered payload as invalid', async () => {
    const jws = tamper(signTestTransaction());
    expect(await kindOf(testVerifier().verifyTransaction(jws))).toBe('invalid');
  });

  it('rejects a wrong bundle id as invalid', async () => {
    const jws = signTestTransaction({ bundleId: 'com.other.app' });
    expect(await kindOf(testVerifier().verifyTransaction(jws))).toBe('invalid');
  });

  it('rejects a chain not rooted in the trusted root as invalid', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'untrusted-pki-'));
    try {
      const script = path.join(__dirname, '..', 'scripts', 'gen-apple-test-pki.sh');
      // Generate a second, different PKI into a copy of the script's output location.
      const copy = path.join(dir, 'scripts');
      execFileSync('mkdir', ['-p', copy, path.join(dir, 'tests')]);
      execFileSync('cp', [script, copy]);
      execFileSync('bash', [path.join(copy, 'gen-apple-test-pki.sh')], { stdio: 'ignore' });
      const out = path.join(dir, 'tests', 'fixtures', 'apple-test-pki');
      const chain = JSON.parse(readFileSync(path.join(out, 'chain.json'), 'utf8'));
      const key = readFileSync(path.join(out, 'leaf.pk8.pem'), 'utf8');
      const jws = signWithChain({}, chain, key);
      expect(await kindOf(testVerifier().verifyTransaction(jws))).toBe('invalid');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns not_configured for Production without appAppleId, Sandbox still works', async () => {
    const verifier = testVerifier({ appAppleId: undefined });
    const prod = signTestTransaction({ environment: 'Production' });
    expect(await kindOf(verifier.verifyTransaction(prod))).toBe('not_configured');
    const sandbox = await verifier.verifyTransaction(signTestTransaction());
    expect(sandbox.environment).toBe('Sandbox');
  });

  it('verifies Production when appAppleId is configured', async () => {
    const tx = await testVerifier().verifyTransaction(
      signTestTransaction({ environment: 'Production' }),
    );
    expect(tx.environment).toBe('Production');
  });

  it('rejects Xcode environment unless allowXcode is true', async () => {
    const jws = signTestTransaction({ environment: 'Xcode' });
    expect(await kindOf(testVerifier({ allowXcode: false }).verifyTransaction(jws))).toBe('invalid');
    const tx = await testVerifier({ allowXcode: true }).verifyTransaction(jws);
    expect(tx.environment).toBe('Xcode');
  });

  it('rejects LocalTesting environment even for unknown values', async () => {
    const jws = signTestTransaction({ environment: 'LocalTesting' });
    expect(await kindOf(testVerifier().verifyTransaction(jws))).toBe('invalid');
  });

  it('rejects unknown environment, missing environment and non-JWS input as invalid', async () => {
    const v = testVerifier();
    expect(await kindOf(v.verifyTransaction(signTestTransaction({ environment: 'Mars' })))).toBe(
      'invalid',
    );
    expect(
      await kindOf(
        v.verifyTransaction(signTestTransaction({ environment: undefined as unknown as string })),
      ),
    ).toBe('invalid');
    expect(await kindOf(v.verifyTransaction('not-a-jws'))).toBe('invalid');
    expect(await kindOf(v.verifyTransaction('a.b.c'))).toBe('invalid');
    expect(await kindOf(v.verifyTransaction(''))).toBe('invalid');
    expect(await kindOf(v.verifyNotification('nope'))).toBe('invalid');
  });

  it('maps a retryable library failure to retryable', async () => {
    const spy = jest
      .spyOn(
        jest.requireActual('@apple/app-store-server-library').SignedDataVerifier.prototype,
        'verifyAndDecodeTransaction',
      )
      .mockRejectedValue(
        new VerificationException(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE),
      );
    try {
      const kind = await kindOf(testVerifier().verifyTransaction(signTestTransaction()));
      expect(kind).toBe('retryable');
    } finally {
      spy.mockRestore();
    }
  });

  it('error messages never contain the JWS', async () => {
    const jws = tamper(signTestTransaction());
    try {
      await testVerifier().verifyTransaction(jws);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppleVerificationError);
      expect((e as Error).message).not.toContain(jws.slice(0, 20));
    }
  });

  it('exposes revocation date and reason as Date and number', async () => {
    const revoked = Date.UTC(2030, 0, 2);
    const tx = await testVerifier().verifyTransaction(
      signTestTransaction({ revocationDate: revoked, revocationReason: 1 }),
    );
    expect(tx.revocationDate).toEqual(new Date(revoked));
    expect(tx.revocationReason).toBe(1);
  });

  it('decodes a REFUND notification with nested transaction', async () => {
    const jws = signTestNotification({
      notificationType: 'REFUND',
      notificationUUID: 'uuid-1',
      transaction: { revocationDate: Date.UTC(2030, 0, 2), revocationReason: 0 },
    });
    const n = await testVerifier().verifyNotification(jws);
    expect(n.notificationType).toBe('REFUND');
    expect(n.subtype).toBeNull();
    expect(n.notificationUUID).toBe('uuid-1');
    expect(n.environment).toBe('Sandbox');
    expect(n.transaction?.productId).toBe(TEST_PRODUCT_ID);
    expect(n.transaction?.revocationDate).toBeInstanceOf(Date);
  });

  it('returns null transaction for a TEST notification', async () => {
    const jws = signTestNotification({ notificationType: 'TEST', withoutTransaction: true });
    const n = await testVerifier().verifyNotification(jws);
    expect(n.notificationType).toBe('TEST');
    expect(n.transaction).toBeNull();
  });

  it('rejects a tampered notification as invalid', async () => {
    const jws = tamper(signTestNotification({ notificationType: 'REFUND', transaction: {} }));
    expect(await kindOf(testVerifier().verifyNotification(jws))).toBe('invalid');
  });
});
