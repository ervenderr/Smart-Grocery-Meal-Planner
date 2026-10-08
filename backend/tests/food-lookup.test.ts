/**
 * Food lookup endpoints. Upstream calls are mocked via a fetch spy.
 *
 * Test-only dependency contract exported by food.service.ts:
 *   setFoodDepsForTests({ usdaApiKey?, offThrottle?, usdaThrottle?, now? })
 *   resetFoodDepsForTests()
 */

import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { logger } from '../src/config/logger.config';
import { config } from '../src/config/env.config';
import { resetFoodDepsForTests, setFoodDepsForTests } from '../src/modules/food/food.service';
import { createOutboundThrottle } from '../src/modules/food/outbound-throttle';
import { createUserWithPantry } from './helpers/ai-test-helpers';

const app = createApp();
const createdUserIds: string[] = [];
const USDA_KEY = 'TESTKEY-usda-abc123';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const barcode = (): string =>
  Array.from(crypto.randomBytes(13), (b) => String(b % 10)).join('');

const offFound = (code: string, tags: string[] = ['en:dairies']): Response =>
  json({
    status: 1,
    product: {
      code,
      product_name: 'Whole Milk',
      brands: 'Acme',
      quantity: '1 L',
      categories_tags: tags,
      image_front_small_url: 'https://images.test/milk.jpg',
      nutriments: { 'energy-kcal_100g': 64, proteins_100g: 3.3, fat_100g: 3.6, carbohydrates_100g: 4.8 },
    },
  });

let fetchSpy: jest.SpyInstance;
let token: string;

beforeAll(async () => {
  const user = await createUserWithPantry(app, []);
  token = user.token;
  createdUserIds.push(user.userId);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

beforeEach(async () => {
  fetchSpy = jest.spyOn(global, 'fetch');
  resetFoodDepsForTests();
  // Fresh user per test so the per-user burst limiter never leaks across tests.
  const user = await createUserWithPantry(app, []);
  token = user.token;
  createdUserIds.push(user.userId);
});

afterEach(() => {
  resetFoodDepsForTests();
});

const lookup = (code: string) =>
  request(app).get(`/api/v1/food/barcode/${code}`).set('Authorization', `Bearer ${token}`);
const nutrition = (query: string) =>
  request(app).get('/api/v1/food/nutrition').query({ query }).set('Authorization', `Bearer ${token}`);

describe('GET /api/v1/food/barcode/:code', () => {
  it('returns the product with attribution and sends a Kitcha User-Agent', async () => {
    const code = barcode();
    fetchSpy.mockResolvedValueOnce(offFound(code));
    const res = await lookup(code);
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.attribution.license).toBe('ODbL');
    expect(res.body.product).toEqual({
      barcode: code,
      name: 'Whole Milk',
      brand: 'Acme',
      quantity: '1 L',
      imageUrl: 'https://images.test/milk.jpg',
      suggestedCategory: 'dairy',
      nutritionPer100g: { energyKcal: 64, protein: 3.3, fat: 3.6, carbs: 4.8 },
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('world.openfoodfacts.org/api/v2/product/' + code);
    expect(init.headers['User-Agent']).toMatch(/^Kitcha\/1\.0 \(/);
    expect(init.headers['User-Agent']).toContain(config.foodData.offContact);
  });

  it('serves a repeat lookup from cache with no extra fetch', async () => {
    const code = barcode();
    fetchSpy.mockResolvedValueOnce(offFound(code, ['en:beverages']));
    const first = await lookup(code);
    expect(first.body.product.suggestedCategory).toBe('beverages');
    const second = await lookup(code);
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('maps unknown categories to other', async () => {
    const code = barcode();
    fetchSpy.mockResolvedValueOnce(offFound(code, ['en:mystery']));
    const res = await lookup(code);
    expect(res.body.product.suggestedCategory).toBe('other');
  });

  it.each([
    ['status 0', () => json({ status: 0 })],
    ['HTTP 404', () => json({ status: 0 }, 404)],
  ])('returns 404 LOOKUP_NOT_FOUND for %s and negative-caches it', async (_n, make) => {
    const code = barcode();
    fetchSpy.mockResolvedValueOnce(make());
    const res = await lookup(code);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LOOKUP_NOT_FOUND');
    expect(res.body.message).toBe('No product found for this barcode.');
    expect(res.body.attribution.license).toBe('ODbL');
    const again = await lookup(code);
    expect(again.status).toBe(404);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid barcodes with 400 and unauthenticated calls with 401', async () => {
    expect((await lookup('abc')).status).toBe(400);
    expect((await lookup('123')).status).toBe(400);
    expect((await request(app).get(`/api/v1/food/barcode/${barcode()}`)).status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 503 LOOKUP_UNAVAILABLE on OFF 503 and on network errors', async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 503));
    const a = await lookup(barcode());
    expect(a.status).toBe(503);
    expect(a.body.code).toBe('LOOKUP_UNAVAILABLE');
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));
    const b = await lookup(barcode());
    expect(b.status).toBe(503);
    expect(b.body.code).toBe('LOOKUP_UNAVAILABLE');
  });

  it('returns 429 LOOKUP_THROTTLED when OFF answers 429', async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 429));
    const res = await lookup(barcode());
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LOOKUP_THROTTLED');
  });

  it('returns 429 LOOKUP_THROTTLED with retryAfterSeconds when the outbound throttle is exhausted', async () => {
    setFoodDepsForTests({ offThrottle: createOutboundThrottle({ limit: 1, windowMs: 60_000 }) });
    const first = barcode();
    fetchSpy.mockResolvedValueOnce(offFound(first));
    expect((await lookup(first)).status).toBe(200);
    const res = await lookup(barcode());
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LOOKUP_THROTTLED');
    expect(res.body.message).toBe('Product lookups are busy, try again in a minute.');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // cached entries bypass the throttle
    expect((await lookup(first)).body.cached).toBe(true);
  });
});

describe('GET /api/v1/food/nutrition', () => {
  const usdaBody = (): Response =>
    json({
      foods: [
        {
          fdcId: 1,
          description: 'Apples, raw',
          dataType: 'Foundation',
          foodNutrients: [
            { nutrientNumber: '208', value: 52 },
            { nutrientNumber: '203', value: 0.3 },
            { nutrientNumber: '204', value: 0.2 },
            { nutrientNumber: '205', value: 13.8 },
          ],
        },
      ],
    });

  it('returns 503 "Nutrition lookup is not configured" without a USDA key', async () => {
    setFoodDepsForTests({ usdaApiKey: undefined });
    const res = await nutrition('apple');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('LOOKUP_UNAVAILABLE');
    expect(res.body.message).toBe('Nutrition lookup is not configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns mapped results with CC0 attribution and keeps the key out of URL, response and logs', async () => {
    setFoodDepsForTests({ usdaApiKey: USDA_KEY });
    const logSpies = (['debug', 'info', 'warn', 'error'] as const).map((l) =>
      jest.spyOn(logger, l).mockImplementation((() => logger) as never)
    );
    const q = `apple${crypto.randomBytes(3).toString('hex')}`;
    fetchSpy.mockResolvedValueOnce(usdaBody());
    const res = await nutrition(q);
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.attribution.license).toBe('CC0');
    expect(res.body.results[0]).toEqual({
      fdcId: 1,
      description: 'Apples, raw',
      dataType: 'Foundation',
      nutritionPer100g: { energyKcal: 52, protein: 0.3, fat: 0.2, carbs: 13.8 },
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).not.toContain('api_key');
    expect(String(url)).not.toContain(USDA_KEY);
    expect(init.headers['X-Api-Key']).toBe(USDA_KEY);
    expect(JSON.stringify(res.body)).not.toContain(USDA_KEY);
    for (const spy of logSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(USDA_KEY);
    }
    const again = await nutrition(q.toUpperCase());
    expect(again.body.cached).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects queries shorter than 2 or longer than 80 characters', async () => {
    setFoodDepsForTests({ usdaApiKey: USDA_KEY });
    expect((await nutrition('a')).status).toBe(400);
    expect((await nutrition('x'.repeat(81))).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 429 LOOKUP_THROTTLED when the USDA throttle is exhausted', async () => {
    setFoodDepsForTests({
      usdaApiKey: USDA_KEY,
      usdaThrottle: createOutboundThrottle({ limit: 1, windowMs: 3_600_000 }),
    });
    fetchSpy.mockResolvedValueOnce(usdaBody());
    expect((await nutrition(`pear${crypto.randomBytes(3).toString('hex')}`)).status).toBe(200);
    const res = await nutrition(`plum${crypto.randomBytes(3).toString('hex')}`);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LOOKUP_THROTTLED');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('cache failures degrade gracefully (WR-01/WR-02)', () => {
  it('serves a barcode lookup when cache read and write both fail', async () => {
    const code = barcode();
    jest.spyOn(prisma.aiCache, 'findUnique').mockRejectedValue(new Error('db down'));
    jest.spyOn(prisma.aiCache, 'upsert').mockRejectedValue(new Error('db down'));
    fetchSpy.mockResolvedValueOnce(offFound(code));

    const res = await lookup(code);

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.product.name).toBe('Whole Milk');
  });

  it('keeps a clean 404 for not-found barcodes when the cache write fails', async () => {
    const code = barcode();
    jest.spyOn(prisma.aiCache, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.aiCache, 'upsert').mockRejectedValue(new Error('db down'));
    fetchSpy.mockResolvedValueOnce(json({ status: 0 }));

    const res = await lookup(code);

    expect(res.status).toBe(404);
  });
});

describe('nutrition query is not HTML-escaped (WR-04)', () => {
  it('forwards apostrophes and ampersands unchanged and strips control characters', async () => {
    setFoodDepsForTests({ usdaApiKey: USDA_KEY });
    const suffix = crypto.randomBytes(3).toString('hex');
    fetchSpy.mockResolvedValueOnce(json({ foods: [] }));

    const res = await nutrition(`Baker's  mac & cheese\u0007 ${suffix}`);

    expect(res.status).toBe(200);
    const url = decodeURIComponent(String(fetchSpy.mock.calls[0][0]));
    expect(url).toContain(`baker's mac & cheese ${suffix}`);
    expect(url).not.toContain('&#x27;');
    expect(url).not.toContain('&amp;');
  });
});

describe('per-user food rate limit (WR-05)', () => {
  it('returns 429 FOOD_RATE_LIMITED after the burst limit without affecting other users', async () => {
    const heavy = await createUserWithPantry(app, []);
    const other = await createUserWithPantry(app, []);
    createdUserIds.push(heavy.userId, other.userId);
    const call = (t: string) =>
      request(app).get('/api/v1/food/barcode/abc').set('Authorization', `Bearer ${t}`);

    for (let i = 0; i < 20; i++) expect((await call(heavy.token)).status).toBe(400);
    const blocked = await call(heavy.token);

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('FOOD_RATE_LIMITED');
    expect((await call(other.token)).status).toBe(400);
  });
});
