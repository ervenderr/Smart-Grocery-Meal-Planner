/**
 * Server-side AI consent gate: generation routes refuse unconsented users
 * before any request data is processed and without any provider call.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { resetAiDepsForTests } from '../src/modules/ai/ai.deps';
import {
  chatCompletion,
  createUserWithPantry,
  grantAiConsent,
  installFakeAi,
  revokeAiConsent,
  uniqueName,
} from './helpers/ai-test-helpers';

const app = createApp();
const MESSAGE = 'AI features are turned off. Accept to continue.';
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

async function newUser(consent: boolean) {
  const user = await createUserWithPantry(app, [uniqueName('rice')], { consent });
  createdUserIds.push(user.userId);
  return user;
}

const post = (path: string, token: string, body: Record<string, unknown> = {}) =>
  request(app).post(`/api/v1/ai/${path}`).set('Authorization', `Bearer ${token}`).send(body);

const ROUTES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['suggest-recipes', {}],
  ['suggest-substitutions', { ingredients: [{ ingredientName: 'milk', quantity: 1, unit: 'cups' }] }],
  ['generate-meal-plan', { daysCount: 2, budgetCents: 50000 }],
];

describe('requireAiConsent', () => {
  it.each(ROUTES)('%s returns 403 AI_CONSENT_REQUIRED with zero provider calls', async (path, body) => {
    const { token } = await newUser(false);

    const res = await post(path, token, body);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_CONSENT_REQUIRED');
    expect(res.body.message).toBe(MESSAGE);
    expect(res.body.error).toBe(MESSAGE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('%s checks consent before validation (invalid body still 403)', async (path) => {
    const { token } = await newUser(false);

    const res = await post(path, token, { daysCount: 'nope', ingredients: 'bad', maxPrepTime: -5 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_CONSENT_REQUIRED');
  });

  it('does not gate GET /ai/status', async () => {
    const { token } = await newUser(false);

    const res = await request(app).get('/api/v1/ai/status').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('allows requests after consent is granted and blocks again after revoke', async () => {
    const { token, userId } = await newUser(false);
    await grantAiConsent(userId);
    fetchSpy.mockResolvedValueOnce(chatCompletion(JSON.stringify({ recipes: [] })));

    const allowed = await post('suggest-recipes', token);
    expect(allowed.status).not.toBe(403);
    expect(fetchSpy).toHaveBeenCalled();

    await revokeAiConsent(userId);
    const blocked = await post('suggest-recipes', token);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('AI_CONSENT_REQUIRED');
  });

  it('treats a stale consent version as no consent', async () => {
    const { token, userId } = await newUser(false);
    await prisma.user.update({
      where: { id: userId },
      data: { aiConsentAt: new Date(), aiConsentVersion: 0 },
    });

    const res = await post('suggest-recipes', token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_CONSENT_REQUIRED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
