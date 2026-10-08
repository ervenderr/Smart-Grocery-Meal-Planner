/**
 * Recipe suggestion slice: provider -> extract -> validate -> repair -> response.
 * The provider is mocked via a fetch spy; no real network calls.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { resetAiDepsForTests, setAiDepsForTests } from '../src/modules/ai/ai.deps';
import { PANTRY_UNITS } from '../src/modules/ai/ai.units';
import {
  buildTestProvider,
  chatCompletion,
  createUserWithPantry,
  errorResponse,
  installFakeAi,
  uniqueName,
} from './helpers/ai-test-helpers';

const app = createApp();
const UNAVAILABLE = 'AI suggestions are unavailable right now, try again later.';
const createdUserIds: string[] = [];

type Recipe = Record<string, unknown>;

const recipe = (name: string, ingredients: string[], extra: Recipe = {}): Recipe => ({
  name,
  description: 'Tasty',
  difficulty: 'easy',
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  ingredients: ingredients.map((n) => ({ ingredientName: n, quantity: 1, unit: 'cups' })),
  instructions: ['Mix', 'Cook'],
  ...extra,
});

const payload = (recipes: Recipe[]): string => JSON.stringify({ recipes });

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
  installFakeAi();
});

afterEach(() => {
  resetAiDepsForTests();
});

afterAll(async () => {
  await prisma.pantryItem.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function newUser(names: string[]) {
  const user = await createUserWithPantry(app, names);
  createdUserIds.push(user.userId);
  return user;
}

const suggest = (token: string, body: Record<string, unknown> = {}) =>
  request(app).post('/api/v1/ai/suggest-recipes').set('Authorization', `Bearer ${token}`).send(body);

describe('POST /api/v1/ai/suggest-recipes (happy path)', () => {
  it('parses a MiniMax <think> reply and returns the RecipeSuggestion shape', async () => {
    const a = uniqueName('rice');
    const b = uniqueName('bean');
    const { token } = await newUser([a, b]);
    const reply = '<think>Let me plan recipes...</think>\n\n' +
      payload([recipe('Rice Bowl', [a, 'salt']), recipe('Bean Stew', [b, 'water'])]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(reply));

    const res = await suggest(token);

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(2);
    expect(res.body.pantryItemsUsed).toBe(2);
    for (const s of res.body.suggestions) {
      expect(s).toEqual(expect.objectContaining({
        name: expect.any(String),
        description: expect.any(String),
        difficulty: expect.stringMatching(/^(easy|medium|hard)$/),
        prepTimeMinutes: expect.any(Number),
        cookTimeMinutes: expect.any(Number),
        ingredients: expect.any(Array),
        instructions: expect.any(Array),
        matchPercentage: expect.any(Number),
      }));
      for (const ing of s.ingredients) expect(PANTRY_UNITS).toContain(ing.unit);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://llm.test/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body as string).model).toBe('test-model');
  });

  it('computes matchPercentage server-side from the current pantry', async () => {
    const a = uniqueName('flour');
    const b = uniqueName('egg');
    const { token } = await newUser([a, b]);
    const r = recipe('Half Match', [a, uniqueName('missing')], { matchPercentage: 999 });
    fetchSpy.mockResolvedValueOnce(chatCompletion(payload([r])));

    const res = await suggest(token);

    expect(res.status).toBe(200);
    expect(res.body.suggestions[0].matchPercentage).toBe(50);
  });
});

describe('repair and failure handling', () => {
  it('repairs once when the first reply has no JSON', async () => {
    const { token } = await newUser([uniqueName('oat')]);
    fetchSpy
      .mockResolvedValueOnce(chatCompletion('Sorry, here is some prose only.'))
      .mockResolvedValueOnce(chatCompletion(payload([recipe('Oats', ['oat'])])));

    const res = await suggest(token);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const second = JSON.parse(fetchSpy.mock.calls[1][1].body as string);
    const roles = second.messages.map((m: { role: string }) => m.role);
    expect(roles).toContain('assistant');
    const last = second.messages[second.messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toMatch(/invalid JSON/i);
  });

  it('returns 503 AI_UNAVAILABLE when output is invalid twice', async () => {
    const { token } = await newUser([uniqueName('kale')]);
    const bad = payload([recipe('Bad', ['kale'], { difficulty: 'impossible' })]);
    fetchSpy
      .mockResolvedValueOnce(chatCompletion(bad))
      .mockResolvedValueOnce(chatCompletion(bad));

    const res = await suggest(token);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
    expect(res.body.message).toBe(UNAVAILABLE);
    expect(res.body.error).toBe(UNAVAILABLE);
    expect(JSON.stringify(res.body)).not.toContain('impossible');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  const failures: Array<[string, () => void]> = [
    ['402', () => fetchSpy.mockResolvedValueOnce(errorResponse(402))],
    ['401', () => fetchSpy.mockResolvedValueOnce(errorResponse(401))],
    ['500', () => fetchSpy.mockResolvedValueOnce(errorResponse(500))],
    ['network TypeError', () => fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'))],
    ['timeout', () => fetchSpy.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))],
  ];

  it.each(failures)('maps provider failure (%s) to 503 AI_UNAVAILABLE without leaking the key', async (_n, arrange) => {
    const { token } = await newUser([uniqueName('pea')]);
    arrange();

    const res = await suggest(token);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
    expect(res.text).not.toContain('test-key');
  });
});

describe('not configured', () => {
  it('returns 503 with zero fetch calls, status available:false, health 200', async () => {
    setAiDepsForTests({ provider: buildTestProvider(undefined) });
    const { token } = await newUser([uniqueName('corn')]);

    const res = await suggest(token);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
    expect(fetchSpy).not.toHaveBeenCalled();

    const status = await request(app).get('/api/v1/ai/status').set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.available).toBe(false);
    expect(status.body.provider).toBe('test');
    expect(Object.values(status.body.features)).toEqual([false, false, false]);

    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
  });
});

describe('data minimization and basic contract', () => {
  it('sends no restriction text or profile data, and wraps pantry in <pantry_data>', async () => {
    const name = uniqueName('tomato');
    const { token, userId, email } = await newUser([name]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(payload([recipe('Soup', [name])])));

    const res = await suggest(token, { dietaryRestrictions: ['vegan', 'peanut allergy'] });

    expect(res.status).toBe(200);
    const sent = (fetchSpy.mock.calls[0][1].body as string);
    const lower = sent.toLowerCase();
    expect(lower).not.toContain('vegan');
    expect(lower).not.toContain('peanut');
    expect(lower).not.toContain(email.toLowerCase());
    expect(lower).not.toContain('aiko');
    expect(lower).not.toContain('tester');
    expect(sent).not.toContain(userId);
    expect(sent).toContain('<pantry_data>');
    expect(sent).toContain('</pantry_data>');
    expect(sent).toContain(name);
  });

  it('keeps 400 for an empty pantry and 401 when unauthenticated', async () => {
    const { token } = await newUser([]);
    const empty = await suggest(token);
    expect(empty.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();

    const anon = await request(app).post('/api/v1/ai/suggest-recipes').send({});
    expect(anon.status).toBe(401);
  });
});
