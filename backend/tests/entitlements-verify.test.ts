/**
 * POST /entitlements/verify and GET /entitlements/me (12-06), supertest + offline signer.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import {
  setAppleVerifierForTests,
  resetAppleVerifierForTests,
} from '../src/modules/entitlements/entitlements.deps';
import { signTestTransaction, testVerifier, TEST_SIGNED_MS } from './helpers/apple-test-signer';
import { randomTransactionId } from './helpers/entitlement-fixtures';

const app = createApp();
const PREFIX = `ent-verify-${Date.now()}`;

interface TestUser {
  readonly token: string;
  readonly id: string;
}

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email: `${PREFIX}-${suffix}@example.com`, password: 'TestPass123', firstName: 'Ent', lastName: 'V' });
  return { token: res.body.token as string, id: res.body.user.id as string };
};

const verify = (u: TestUser | null, body: unknown, headers: Record<string, string> = {}) => {
  const req = request(app).post('/api/v1/entitlements/verify').set(headers);
  if (u) req.set('Authorization', `Bearer ${u.token}`);
  return req.send(body as object);
};

let keyCounter = 0;
const newKey = (): string => `${PREFIX}-key-${++keyCounter}`;

describe('entitlements HTTP', () => {
  let u1: TestUser;
  let u2: TestUser;
  let u3: TestUser;

  beforeAll(async () => {
    setAppleVerifierForTests(testVerifier());
    u1 = await signup('1');
    u2 = await signup('2');
    u3 = await signup('3');
  });

  afterAll(async () => {
    resetAppleVerifierForTests();
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.idempotencyKey.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('requires authentication on both routes', async () => {
    await verify(null, { signedTransaction: signTestTransaction() }).expect(401);
    await request(app).get('/api/v1/entitlements/me').expect(401);
  });

  it.each([
    ['empty body', {}],
    ['non-string', { signedTransaction: 1234567890 }],
    ['too short', { signedTransaction: 'abc' }],
    ['too long', { signedTransaction: 'a'.repeat(16385) }],
    ['extra keys', { signedTransaction: 'a'.repeat(40), isPremium: true }],
  ])('rejects invalid body: %s', async (_label, body) => {
    const res = await verify(u1, body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('verifies a valid transaction and /me reflects it', async () => {
    const orig = randomTransactionId();
    const res = await verify(u1, {
      signedTransaction: signTestTransaction({ originalTransactionId: orig, transactionId: orig }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'active',
      productId: 'app.kitcha.mobile.full',
      environment: 'Sandbox',
    });
    expect(typeof res.body.purchasedAt).toBe('string');

    const me = await request(app).get('/api/v1/entitlements/me').set('Authorization', `Bearer ${u1.token}`);
    expect(me.status).toBe(200);
    expect(me.body.status).toBe('active');
    expect(me.body.limits).toEqual({ pantry: null, aiDaily: 40, aiMonthly: 600 });
  });

  it('/me for a user with no purchase reports free limits', async () => {
    const me = await request(app).get('/api/v1/entitlements/me').set('Authorization', `Bearer ${u3.token}`);
    expect(me.status).toBe(200);
    expect(me.body.status).toBe('none');
    expect(me.body.limits).toEqual({ pantry: 25, aiDaily: 20, aiMonthly: null });
  });

  it('replays the same Idempotency-Key with the original body and one row', async () => {
    const orig = randomTransactionId();
    const body = { signedTransaction: signTestTransaction({ originalTransactionId: orig, transactionId: orig }) };
    const key = newKey();
    const first = await verify(u2, body, { 'Idempotency-Key': key });
    const second = await verify(u2, body, { 'Idempotency-Key': key });
    expect(first.status).toBe(200);
    expect(first.headers['idempotency-replayed']).toBeUndefined();
    expect(second.status).toBe(200);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await prisma.entitlement.count({ where: { userId: u2.id } })).toBe(1);
  });

  it('returns 409 when another account already claimed the purchase', async () => {
    const orig = randomTransactionId();
    const body = { signedTransaction: signTestTransaction({ originalTransactionId: orig, transactionId: orig }) };
    await verify(u3, body).expect(200);
    const res = await verify(u1, body);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ENTITLEMENT_ALREADY_CLAIMED');
  });

  it('returns revoked for a JWS with revocationDate', async () => {
    const orig = randomTransactionId();
    const res = await verify(u3, {
      signedTransaction: signTestTransaction({
        originalTransactionId: orig,
        transactionId: orig,
        signedDate: TEST_SIGNED_MS + 60_000,
        revocationDate: TEST_SIGNED_MS + 50_000,
        revocationReason: 0,
      }),
    });
    // u3 already holds a different active purchase, which must not be replaced
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');

    const fresh = await signup('rev');
    const orig2 = randomTransactionId();
    const res2 = await verify(fresh, {
      signedTransaction: signTestTransaction({
        originalTransactionId: orig2,
        transactionId: orig2,
        revocationDate: TEST_SIGNED_MS,
        revocationReason: 0,
      }),
    });
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('revoked');
  });

  it('returns 400 INVALID_TRANSACTION without leaking the JWS or library text', async () => {
    const jws = signTestTransaction({ bundleId: 'com.evil.app' });
    const res = await verify(u2, { signedTransaction: jws });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSACTION');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(jws);
    expect(text.toLowerCase()).not.toContain('verificationexception');
    expect(text.toLowerCase()).not.toContain('bundle');
  });

  it('limits verify calls to 30 per window per user with ENTITLEMENT_RATE_LIMITED', async () => {
    const limited = await signup('limited');
    const body = { signedTransaction: signTestTransaction({ bundleId: 'com.evil.app' }) };
    let lastStatus = 0;
    let lastCode: string | undefined;
    for (let i = 0; i < 31; i++) {
      const res = await verify(limited, body);
      lastStatus = res.status;
      lastCode = res.body.code;
    }
    expect(lastStatus).toBe(429);
    expect(lastCode).toBe('ENTITLEMENT_RATE_LIMITED');
  });
});
