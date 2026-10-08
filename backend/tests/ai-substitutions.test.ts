/**
 * Ingredient substitutions through the validated provider pipeline.
 * The provider is mocked via a fetch spy; no real network calls.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { resetAiDepsForTests, setAiDepsForTests } from '../src/modules/ai/ai.deps';
import {
  buildTestProvider,
  chatCompletion,
  createUserWithPantry,
  errorResponse,
  installFakeAi,
  uniqueName,
} from './helpers/ai-test-helpers';

const app = createApp();
const createdUserIds: string[] = [];

const sub = (original: string, substitute: string, savings: unknown = 25) => ({
  original,
  substitute,
  reason: 'Cheaper and similar',
  estimatedSavingsPercent: savings,
});

const reply = (substitutions: unknown[]): string => JSON.stringify({ substitutions });

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
  installFakeAi();
});

afterEach(() => {
  resetAiDepsForTests();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function newUser() {
  const user = await createUserWithPantry(app, []);
  createdUserIds.push(user.userId);
  return user;
}

const substitute = (token: string, names: string[]) =>
  request(app)
    .post('/api/v1/ai/suggest-substitutions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      ingredients: names.map((ingredientName) => ({ ingredientName, quantity: 1, unit: 'kg' })),
    });

describe('POST /api/v1/ai/suggest-substitutions', () => {
  it('returns the existing suggestions shape and coerces savings strings', async () => {
    const { token } = await newUser();
    const name = uniqueName('salmon');
    fetchSpy.mockResolvedValueOnce(
      chatCompletion(`<think>hmm</think>${reply([sub(name, 'canned tuna', '30')])}`)
    );

    const res = await substitute(token, [name]);

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([
      {
        original: name,
        substitute: 'canned tuna',
        reason: 'Cheaper and similar',
        estimatedSavingsPercent: 30,
      },
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('wraps ingredients in <ingredient_data>', async () => {
    const { token } = await newUser();
    const name = uniqueName('basil');
    fetchSpy.mockResolvedValueOnce(chatCompletion(reply([])));

    const res = await substitute(token, [name]);

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
    const sent = fetchSpy.mock.calls[0][1].body as string;
    expect(sent).toContain('<ingredient_data>');
    expect(sent).toContain(name);
  });

  it('maps provider 429 to 503 AI_UNAVAILABLE', async () => {
    const { token } = await newUser();
    fetchSpy.mockResolvedValueOnce(errorResponse(429));

    const res = await substitute(token, [uniqueName('lime')]);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
  });

  it('repairs once then gives 503 when output stays invalid', async () => {
    const { token } = await newUser();
    const bad = reply([sub('a', 'b', 500)]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(bad)).mockResolvedValueOnce(chatCompletion(bad));

    const res = await substitute(token, [uniqueName('mint')]);

    expect(res.status).toBe(503);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/v1/ai/status', () => {
  it('reports all features false without a key and true with one', async () => {
    const { token } = await newUser();
    setAiDepsForTests({ provider: buildTestProvider(null) });
    const off = await request(app).get('/api/v1/ai/status').set('Authorization', `Bearer ${token}`);
    expect(off.body.available).toBe(false);
    expect(Object.values(off.body.features)).toEqual([false, false, false]);

    installFakeAi();
    const on = await request(app).get('/api/v1/ai/status').set('Authorization', `Bearer ${token}`);
    expect(on.body.available).toBe(true);
    expect(Object.values(on.body.features)).toEqual([true, true, true]);
  });
});
