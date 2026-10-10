/**
 * AI consent record endpoints (STORE-02): read, grant (server-stamped,
 * idempotent) and withdraw, plus the end-to-end loop against the gate.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { resetAiDepsForTests } from '../src/modules/ai/ai.deps';
import { AI_CONSENT_VERSION } from '../src/modules/ai/ai-consent.constants';
import { toAiConsentStatus } from '../src/modules/users/ai-consent.service';
import {
  chatCompletion,
  createUserWithPantry,
  installFakeAi,
  uniqueName,
} from './helpers/ai-test-helpers';

const app = createApp();
const URL = '/api/v1/users/me/ai-consent';
const createdUserIds: string[] = [];
let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
  installFakeAi();
});

afterEach(() => {
  fetchSpy.mockRestore();
  resetAiDepsForTests();
});

afterAll(async () => {
  await prisma.pantryItem.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function newUser(consent = false) {
  const user = await createUserWithPantry(app, [uniqueName('rice')], { consent });
  createdUserIds.push(user.userId);
  return user;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('toAiConsentStatus', () => {
  it('maps null fields to unconsented', () => {
    expect(toAiConsentStatus({ aiConsentAt: null, aiConsentVersion: null })).toEqual({
      consented: false,
      consentedAt: null,
      version: null,
      currentVersion: AI_CONSENT_VERSION,
    });
  });

  it('treats a stale version as unconsented but reports it', () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    const status = toAiConsentStatus({ aiConsentAt: at, aiConsentVersion: 0 });
    expect(status.consented).toBe(false);
    expect(status.version).toBe(0);
    expect(status.consentedAt).toBe(at.toISOString());
  });
});

describe('/users/me/ai-consent', () => {
  it('GET returns unconsented for a new user', async () => {
    const { token } = await newUser();
    const res = await request(app).get(URL).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      consented: false,
      consentedAt: null,
      version: null,
      currentVersion: AI_CONSENT_VERSION,
    });
  });

  it('POST grants consent and is idempotent', async () => {
    const { token } = await newUser();
    const first = await request(app).post(URL).set(auth(token));
    expect(first.status).toBe(200);
    expect(first.body.consented).toBe(true);
    expect(first.body.version).toBe(AI_CONSENT_VERSION);
    expect(typeof first.body.consentedAt).toBe('string');

    const second = await request(app).post(URL).set(auth(token));
    expect(second.status).toBe(200);
    expect(second.body.consentedAt).toBe(first.body.consentedAt);
  });

  it('POST ignores client-supplied timestamp and version', async () => {
    const { token, userId } = await newUser();
    const res = await request(app)
      .post(URL)
      .set(auth(token))
      .send({ consentedAt: '2000-01-01', version: 99 });
    expect(res.status).toBe(200);
    const row = await prisma.user.findUnique({ where: { id: userId } });
    expect(row?.aiConsentVersion).toBe(AI_CONSENT_VERSION);
    expect(row?.aiConsentAt?.getFullYear()).toBeGreaterThan(2000);
  });

  it('POST re-stamps a stale-version consent', async () => {
    const { token, userId } = await newUser();
    const old = new Date('2020-01-01T00:00:00.000Z');
    await prisma.user.update({
      where: { id: userId },
      data: { aiConsentAt: old, aiConsentVersion: 0 },
    });
    const get = await request(app).get(URL).set(auth(token));
    expect(get.body.consented).toBe(false);

    const res = await request(app).post(URL).set(auth(token));
    expect(res.body.consented).toBe(true);
    expect(res.body.version).toBe(AI_CONSENT_VERSION);
    expect(new Date(res.body.consentedAt).getTime()).toBeGreaterThan(old.getTime());
  });

  it('DELETE withdraws consent, nulls fields and never deletes the user', async () => {
    const { token, userId } = await newUser(true);
    const res = await request(app).delete(URL).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.consented).toBe(false);
    expect(res.body.consentedAt).toBeNull();
    expect(res.body.version).toBeNull();

    const row = await prisma.user.findUnique({ where: { id: userId } });
    expect(row).not.toBeNull();
    expect(row?.aiConsentAt).toBeNull();
    expect(row?.aiConsentVersion).toBeNull();
  });

  it.each(['get', 'post', 'delete'] as const)('%s without a token returns 401', async (m) => {
    const res = await request(app)[m](URL);
    expect(res.status).toBe(401);
  });

  it('end to end: gate follows grant and withdraw immediately', async () => {
    const { token } = await newUser(false);
    const suggest = () =>
      request(app).post('/api/v1/ai/suggest-recipes').set(auth(token)).send({});

    const before = await suggest();
    expect(before.status).toBe(403);
    expect(before.body.code).toBe('AI_CONSENT_REQUIRED');

    await request(app).post(URL).set(auth(token));
    fetchSpy.mockResolvedValueOnce(chatCompletion(JSON.stringify({ recipes: [] })));
    const allowed = await suggest();
    expect(allowed.status).not.toBe(403);

    await request(app).delete(URL).set(auth(token));
    const after = await suggest();
    expect(after.status).toBe(403);
    expect(after.body.code).toBe('AI_CONSENT_REQUIRED');
  });

  it('profile exposes consent fields and never passwordHash', async () => {
    const { token } = await newUser(false);
    await request(app).post(URL).set(auth(token));
    const res = await request(app).get('/api/v1/users/profile').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.aiConsentAt).not.toBeNull();
    expect(res.body.aiConsentVersion).toBe(1);
    expect(res.body.passwordHash).toBeUndefined();
  });
});
