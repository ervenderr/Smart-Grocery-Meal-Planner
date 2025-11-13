/**
 * Market Price Tests
 *
 * Tests for market price tracking and currency conversion endpoints.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();

describe('Market Price Endpoints', () => {
  const testUser = {
    email: 'price-test@example.com',
    password: 'TestPass123',
    firstName: 'Price',
    lastName: 'Test',
  };

  let authToken: string;

  // Setup: Create test user
  beforeAll(async () => {
    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send(testUser);

    authToken = response.body.token;
  });

  // Cleanup: Delete test data
  afterAll(async () => {
    await prisma.marketPrice.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'price-test' } },
    });
  });

  describe('POST /api/v1/prices/fetch', () => {
    it('should fetch and store current price', async () => {
      const response = await request(app)
        .post('/api/v1/prices/fetch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ symbol: 'PHP' })
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'PHP');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('lastUpdated');
      expect(typeof response.body.price).toBe('number');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/prices/fetch')
        .send({ symbol: 'USD' })
        .expect(401);
    });

    it('should validate symbol', async () => {
      const response = await request(app)
        .post('/api/v1/prices/fetch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ symbol: 'X' }) // Too short
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/v1/prices', () => {
    beforeAll(async () => {
      // Fetch some prices to have data
      await request(app)
        .post('/api/v1/prices/fetch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ symbol: 'USD' });
    });

    it('should return all market prices', async () => {
      const response = await request(app)
        .get('/api/v1/prices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter by symbol', async () => {
      const response = await request(app)
        .get('/api/v1/prices?symbol=USD')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((item: any) => item.symbol === 'USD')).toBe(
        true
      );
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/prices?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
      });
      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/prices/:symbol/current', () => {
    it('should return current price for a symbol', async () => {
      const response = await request(app)
        .get('/api/v1/prices/PHP/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'PHP');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('lastUpdated');
      expect(typeof response.body.price).toBe('number');
    });

    it('should return 200 even for new symbol (fetches it)', async () => {
      const response = await request(app)
        .get('/api/v1/prices/EUR/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'EUR');
      expect(response.body).toHaveProperty('price');
    });

    it('should validate symbol format', async () => {
      await request(app)
        .get('/api/v1/prices/X/current') // Too short
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('POST /api/v1/prices/convert', () => {
    beforeAll(async () => {
      // Ensure we have prices for conversion
      await request(app)
        .post('/api/v1/prices/fetch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ symbol: 'PHP' });

      await request(app)
        .post('/api/v1/prices/fetch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ symbol: 'USD' });
    });

    it('should convert between currencies', async () => {
      const response = await request(app)
        .post('/api/v1/prices/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          fromCurrency: 'PHP',
          toCurrency: 'USD',
        })
        .expect(200);

      expect(response.body).toHaveProperty('amount', 100);
      expect(response.body).toHaveProperty('fromCurrency', 'PHP');
      expect(response.body).toHaveProperty('toCurrency', 'USD');
      expect(response.body).toHaveProperty('convertedAmount');
      expect(response.body).toHaveProperty('exchangeRate');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.convertedAmount).toBe('number');
      expect(typeof response.body.exchangeRate).toBe('number');
    });

    it('should reject negative amount', async () => {
      const response = await request(app)
        .post('/api/v1/prices/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -100,
          fromCurrency: 'PHP',
          toCurrency: 'USD',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should validate currency formats', async () => {
      const response = await request(app)
        .post('/api/v1/prices/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          fromCurrency: 'X', // Too short
          toCurrency: 'USD',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/v1/prices/:symbol/history', () => {
    beforeAll(async () => {
      // Fetch price multiple times to create history
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/prices/fetch')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ symbol: 'GBP' });
      }
    });

    it('should return price history', async () => {
      const response = await request(app)
        .get('/api/v1/prices/GBP/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'GBP');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('date');
        expect(response.body.data[0]).toHaveProperty('price');
        expect(response.body.data[0]).toHaveProperty('high');
        expect(response.body.data[0]).toHaveProperty('low');
      }
    });

    it('should accept days parameter', async () => {
      const response = await request(app)
        .get('/api/v1/prices/GBP/history?days=30')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'GBP');
      expect(response.body).toHaveProperty('data');
    });

    it('should validate days range', async () => {
      await request(app)
        .get('/api/v1/prices/PHP/history?days=9999') // Too large
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/prices/:symbol/stats', () => {
    beforeAll(async () => {
      // Fetch price multiple times to create statistics
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/prices/fetch')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ symbol: 'EUR' });
      }
    });

    it('should return price statistics', async () => {
      const response = await request(app)
        .get('/api/v1/prices/EUR/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol', 'EUR');
      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('high24h');
      expect(response.body).toHaveProperty('low24h');
      expect(response.body).toHaveProperty('average24h');
      expect(response.body).toHaveProperty('change24h');
      expect(response.body).toHaveProperty('changePercentage24h');
      expect(typeof response.body.current).toBe('number');
    });

    it('should return 404 for symbol with no data', async () => {
      await request(app)
        .get('/api/v1/prices/ZZZ/stats') // Short symbol that doesn't exist
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
