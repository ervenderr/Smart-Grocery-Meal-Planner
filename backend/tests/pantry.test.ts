/**
 * Pantry Tests
 *
 * Tests for pantry item management endpoints.
 *
 * WHAT WE'RE TESTING:
 * - Create pantry item
 * - Get all pantry items (with filtering)
 * - Get single pantry item
 * - Update pantry item
 * - Delete pantry item
 * - Get pantry statistics
 * - Expiry tracking
 * - Validation
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();

describe('Pantry Endpoints', () => {
  const testUser = {
    email: 'pantry-test@example.com',
    password: 'TestPass123',
    firstName: 'Pantry',
    lastName: 'Test',
  };

  let authToken: string;
  let userId: string;
  let pantryItemId: string;

  // Setup: Create test user
  beforeAll(async () => {
    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send(testUser);

    authToken = response.body.token;
    userId = response.body.user.id;
  });

  // Cleanup: Delete test user and pantry items
  afterAll(async () => {
    await prisma.pantryItem.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'pantry-test' } },
    });
  });

  describe('POST /api/v1/pantry', () => {
    it('should create a new pantry item', async () => {
      const newItem = {
        ingredientName: 'Chicken Breast',
        quantity: 2.5,
        unit: 'lbs',
        category: 'protein',
        expiryDate: '2025-12-31',
        purchaseDate: '2025-11-01',
        purchasePriceCents: 1250,
        location: 'freezer',
        notes: 'Organic chicken',
      };

      const response = await request(app)
        .post('/api/v1/pantry')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newItem)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toMatchObject({
        ingredientName: newItem.ingredientName,
        quantity: '2.5',
        unit: newItem.unit,
        category: newItem.category,
        location: newItem.location,
        notes: newItem.notes,
      });
      expect(response.body).toHaveProperty('isExpired', false);
      expect(response.body).toHaveProperty('daysUntilExpiry');

      pantryItemId = response.body.id;
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/pantry')
        .send({
          ingredientName: 'Test',
          quantity: 1,
          unit: 'pieces',
          category: 'other',
        })
        .expect(401);
    });

    it('should reject invalid quantity', async () => {
      const response = await request(app)
        .post('/api/v1/pantry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ingredientName: 'Test',
          quantity: 0,
          unit: 'pieces',
          category: 'other',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject invalid unit', async () => {
      const response = await request(app)
        .post('/api/v1/pantry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ingredientName: 'Test',
          quantity: 1,
          unit: 'invalid-unit',
          category: 'other',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject invalid category', async () => {
      const response = await request(app)
        .post('/api/v1/pantry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ingredientName: 'Test',
          quantity: 1,
          unit: 'pieces',
          category: 'invalid-category',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/v1/pantry', () => {
    it('should return all pantry items', async () => {
      const response = await request(app)
        .get('/api/v1/pantry')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/v1/pantry?category=protein')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((item: any) => item.category === 'protein')).toBe(true);
    });

    it('should filter by location', async () => {
      const response = await request(app)
        .get('/api/v1/pantry?location=freezer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((item: any) => item.location === 'freezer')).toBe(true);
    });

    it('should search by ingredient name', async () => {
      const response = await request(app)
        .get('/api/v1/pantry?search=Chicken')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(
        response.body.items.every((item: any) =>
          item.ingredientName.toLowerCase().includes('chicken')
        )
      ).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/pantry?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
      });
      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/pantry').expect(401);
    });
  });

  describe('GET /api/v1/pantry/:id', () => {
    it('should return a single pantry item', async () => {
      const response = await request(app)
        .get(`/api/v1/pantry/${pantryItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', pantryItemId);
      expect(response.body).toHaveProperty('ingredientName');
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/pantry/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should require authentication', async () => {
      await request(app).get(`/api/v1/pantry/${pantryItemId}`).expect(401);
    });
  });

  describe('PATCH /api/v1/pantry/:id', () => {
    it('should update pantry item', async () => {
      const updates = {
        quantity: 1.5,
        notes: 'Updated notes',
      };

      const response = await request(app)
        .patch(`/api/v1/pantry/${pantryItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        id: pantryItemId,
        quantity: '1.5',
        notes: updates.notes,
      });
    });

    it('should reject invalid quantity update', async () => {
      const response = await request(app)
        .patch(`/api/v1/pantry/${pantryItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: -5 })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .patch(`/api/v1/pantry/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 5 })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .patch(`/api/v1/pantry/${pantryItemId}`)
        .send({ quantity: 5 })
        .expect(401);
    });
  });

  describe('GET /api/v1/pantry/stats', () => {
    it('should return pantry statistics', async () => {
      const response = await request(app)
        .get('/api/v1/pantry/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalItems');
      expect(response.body).toHaveProperty('totalValue');
      expect(response.body).toHaveProperty('expiringWithin7Days');
      expect(response.body).toHaveProperty('expired');
      expect(response.body).toHaveProperty('byCategory');
      expect(response.body).toHaveProperty('byLocation');
      expect(typeof response.body.totalItems).toBe('number');
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/pantry/stats').expect(401);
    });
  });

  describe('Expiry Tracking', () => {
    let expiringItemId: string;
    let expiredItemId: string;

    beforeAll(async () => {
      // Create an item expiring soon
      const today = new Date();
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const expiringResponse = await request(app)
        .post('/api/v1/pantry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ingredientName: 'Expiring Milk',
          quantity: 1,
          unit: 'liters',
          category: 'dairy',
          expiryDate: threeDaysFromNow.toISOString().split('T')[0],
        });

      expiringItemId = expiringResponse.body.id;

      // Create an expired item
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const expiredResponse = await request(app)
        .post('/api/v1/pantry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ingredientName: 'Expired Yogurt',
          quantity: 1,
          unit: 'cups',
          category: 'dairy',
          expiryDate: yesterday.toISOString().split('T')[0],
        });

      expiredItemId = expiredResponse.body.id;
    });

    it('should mark expired items correctly', async () => {
      const response = await request(app)
        .get(`/api/v1/pantry/${expiredItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isExpired).toBe(true);
      expect(response.body.daysUntilExpiry).toBeNull();
    });

    it('should calculate days until expiry', async () => {
      const response = await request(app)
        .get(`/api/v1/pantry/${expiringItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isExpired).toBe(false);
      expect(response.body.daysUntilExpiry).toBeGreaterThan(0);
      expect(response.body.daysUntilExpiry).toBeLessThanOrEqual(4);
    });

    it('should filter expiring soon items', async () => {
      const response = await request(app)
        .get('/api/v1/pantry?expiringSoon=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should include the expiring milk item
      const expiringMilk = response.body.items.find(
        (item: any) => item.id === expiringItemId
      );
      expect(expiringMilk).toBeDefined();
      expect(expiringMilk.isExpired).toBe(false);

      // Should not include expired items
      const hasExpiredItems = response.body.items.some(
        (item: any) => item.isExpired === true
      );
      expect(hasExpiredItems).toBe(false);
    });

    it('should filter expired items', async () => {
      const response = await request(app)
        .get('/api/v1/pantry?expired=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should include the expired yogurt item
      const expiredYogurt = response.body.items.find(
        (item: any) => item.id === expiredItemId
      );
      expect(expiredYogurt).toBeDefined();
      expect(expiredYogurt.isExpired).toBe(true);
    });
  });

  describe('DELETE /api/v1/pantry/:id', () => {
    it('should delete a pantry item', async () => {
      const response = await request(app)
        .delete(`/api/v1/pantry/${pantryItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify item is deleted (soft delete)
      await request(app)
        .get(`/api/v1/pantry/${pantryItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .delete(`/api/v1/pantry/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app).delete(`/api/v1/pantry/${pantryItemId}`).expect(401);
    });
  });
});
