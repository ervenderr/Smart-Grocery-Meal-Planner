/**
 * Unit tests for the throttle and the OFF / USDA clients. fetch is spied;
 * no real network calls are made.
 */

import { createOutboundThrottle } from '../src/modules/food/outbound-throttle';
import { fetchOffProduct, mapCategory, FoodUpstreamError } from '../src/modules/food/off.client';
import { searchUsda } from '../src/modules/food/usda.client';
import { OFF_ATTRIBUTION, USDA_ATTRIBUTION } from '../src/modules/food/food.attribution';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
});

describe('createOutboundThrottle', () => {
  it('allows 12 acquisitions then denies with retryAfterSeconds, then allows after the window', () => {
    let t = 1_000_000;
    const throttle = createOutboundThrottle({ limit: 12, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 12; i += 1) {
      expect(throttle.tryAcquire()).toEqual({ allowed: true });
    }
    const denied = throttle.tryAcquire();
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    t += 60_001;
    expect(throttle.tryAcquire()).toEqual({ allowed: true });
  });
});

describe('mapCategory', () => {
  it.each([
    [['en:dairies'], 'dairy'],
    [['en:beverages'], 'beverages'],
    [['en:meats'], 'protein'],
    [['en:fruits'], 'fruit'],
    [['en:pastas'], 'grains'],
    [['en:something-odd'], 'other'],
    [undefined, 'other'],
  ])('maps %p to %s', (tags, expected) => {
    expect(mapCategory(tags as string[] | undefined)).toBe(expected);
  });
});

describe('attribution constants', () => {
  it('carry the licenses', () => {
    expect(OFF_ATTRIBUTION.license).toBe('ODbL');
    expect(USDA_ATTRIBUTION.license).toBe('CC0');
  });
});

describe('fetchOffProduct', () => {
  it('sends a Kitcha User-Agent and parses a found product', async () => {
    fetchSpy.mockResolvedValueOnce(
      json({
        status: 1,
        product: {
          code: '3017620422003',
          product_name: 'Hazelnut spread',
          brands: 'Brand',
          quantity: '400 g',
          categories_tags: ['en:spreads'],
          nutriments: { 'energy-kcal_100g': '539', proteins_100g: 6.3, fat_100g: 30.9, carbohydrates_100g: 57.5 },
        },
      })
    );
    const result = await fetchOffProduct('3017620422003', { contact: 'https://example.test/contact' });
    expect(result.kind).toBe('found');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('https://world.openfoodfacts.org/api/v2/product/3017620422003.json');
    expect(init.headers['User-Agent']).toBe('Kitcha/1.0 (https://example.test/contact)');
    if (result.kind === 'found') {
      expect(result.product.product_name).toBe('Hazelnut spread');
      expect(result.product.nutriments?.['energy-kcal_100g']).toBe(539);
    }
  });

  it('returns not_found for status 0 and HTTP 404', async () => {
    fetchSpy.mockResolvedValueOnce(json({ status: 0 }));
    expect((await fetchOffProduct('11111111', { contact: 'c' })).kind).toBe('not_found');
    fetchSpy.mockResolvedValueOnce(json({ status: 0 }, 404));
    expect((await fetchOffProduct('11111111', { contact: 'c' })).kind).toBe('not_found');
  });

  it('maps 429 to throttled and 503 / network errors to unavailable', async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 429));
    await expect(fetchOffProduct('11111111', { contact: 'c' })).rejects.toMatchObject({ kind: 'throttled' });
    fetchSpy.mockResolvedValueOnce(json({}, 503));
    await expect(fetchOffProduct('11111111', { contact: 'c' })).rejects.toBeInstanceOf(FoodUpstreamError);
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(fetchOffProduct('11111111', { contact: 'c' })).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('treats a malformed body as unavailable', async () => {
    fetchSpy.mockResolvedValueOnce(json({ status: 1, product: { product_name: 42 } }));
    await expect(fetchOffProduct('11111111', { contact: 'c' })).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('searchUsda', () => {
  it('sends the key only in the X-Api-Key header and maps nutrients', async () => {
    fetchSpy.mockResolvedValueOnce(
      json({
        foods: [
          {
            fdcId: 171688,
            description: 'Apples, raw',
            dataType: 'SR Legacy',
            foodNutrients: [
              { nutrientNumber: '208', nutrientName: 'Energy', value: 52 },
              { nutrientNumber: '203', nutrientName: 'Protein', value: 0.26 },
              { nutrientName: 'Total lipid (fat)', value: 0.17 },
              { nutrientNumber: '205', nutrientName: 'Carbohydrate, by difference', value: 13.8 },
            ],
          },
        ],
      })
    );
    const results = await searchUsda('apple', { apiKey: 'SECRET-KEY-123' });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).not.toContain('api_key');
    expect(String(url)).not.toContain('SECRET-KEY-123');
    expect(init.headers['X-Api-Key']).toBe('SECRET-KEY-123');
    expect(results).toEqual([
      {
        fdcId: 171688,
        description: 'Apples, raw',
        dataType: 'SR Legacy',
        nutritionPer100g: { energyKcal: 52, protein: 0.26, fat: 0.17, carbs: 13.8 },
      },
    ]);
  });

  it('maps 429 to throttled and 500 to unavailable', async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 429));
    await expect(searchUsda('apple', { apiKey: 'k' })).rejects.toMatchObject({ kind: 'throttled' });
    fetchSpy.mockResolvedValueOnce(json({}, 500));
    await expect(searchUsda('apple', { apiKey: 'k' })).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('pickEnergyKcal (WR-10)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pickEnergyKcal } = require('../src/modules/food/usda.client');

  it('prefers the kcal entry over a kJ entry with the same name', () => {
    expect(
      pickEnergyKcal([
        { nutrientNumber: '268', nutrientName: 'Energy', unitName: 'KJ', value: 218 },
        { nutrientNumber: '957', nutrientName: 'Energy (Atwater General Factors)', unitName: 'KCAL', value: 52 },
      ])
    ).toBe(52);
  });

  it('converts a kJ-only energy entry to kcal', () => {
    expect(pickEnergyKcal([{ nutrientNumber: '268', nutrientName: 'Energy', unitName: 'KJ', value: 418.4 }])).toBe(100);
  });

  it('ignores name matches with unknown unit and returns null', () => {
    expect(pickEnergyKcal([{ nutrientName: 'Energy', value: 218 }])).toBeNull();
  });

  it('uses nutrient 208 directly', () => {
    expect(pickEnergyKcal([{ nutrientNumber: 208, unitName: 'KCAL', value: 64 }])).toBe(64);
  });
});
