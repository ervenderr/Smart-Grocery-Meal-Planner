/**
 * Alert Tests
 *
 * Tests for budget & alert management endpoints.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();

describe('Alert Endpoints', () => {
  const testUser = {
    email: 'alert-test@example.com',
    password: 'TestPass123',
    firstName: 'Alert',
    lastName: 'Test',
  };

  let authToken: string;
  let userId: string;
  let alertId: string;

  // Setup: Create test user
  beforeAll(async () => {
    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send(testUser);

    authToken = response.body.token;
    userId = response.body.user.id;

    // Create user preferences with budget
    await prisma.userPreference.update({
      where: { userId },
      data: {
        budgetPerWeekCents: 500000, // ₱5000
        alertThresholdPercentage: 80,
      },
    });
  });

  // Cleanup: Delete test data
  afterAll(async () => {
    await prisma.alert.deleteMany({
      where: { userId },
    });
    await prisma.shoppingHistory.deleteMany({
      where: { userId },
    });
    await prisma.pantryItem.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'alert-test' } },
    });
  });

  describe('GET /api/v1/alerts/budget/status', () => {
    it('should get budget status with no spending', async () => {
      const response = await request(app)
        .get('/api/v1/alerts/budget/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('weeklyBudgetCents', 500000);
      expect(response.body).toHaveProperty('spentThisWeekCents', 0);
      expect(response.body).toHaveProperty('remainingCents', 500000);
      expect(response.body).toHaveProperty('percentageUsed', 0);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('weekStart');
      expect(response.body).toHaveProperty('weekEnd');
    });

    it('should calculate budget status with spending', async () => {
      // Add shopping history for this week
      const today = new Date();
      await prisma.shoppingHistory.create({
        data: {
          userId,
          receiptDate: today,
          totalPhpCents: 300000, // ₱3000 (60% of budget)
        },
      });

      const response = await request(app)
        .get('/api/v1/alerts/budget/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('weeklyBudgetCents', 500000);
      expect(response.body).toHaveProperty('spentThisWeekCents', 300000);
      expect(response.body).toHaveProperty('remainingCents', 200000);
      expect(response.body).toHaveProperty('percentageUsed', 60);
      expect(response.body).toHaveProperty('status', 'healthy');
    });

    it('should show warning status when threshold exceeded', async () => {
      // Add more spending to exceed threshold (80%)
      const today = new Date();
      await prisma.shoppingHistory.create({
        data: {
          userId,
          receiptDate: today,
          totalPhpCents: 150000, // ₱1500 (total: 90%)
        },
      });

      const response = await request(app)
        .get('/api/v1/alerts/budget/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('spentThisWeekCents', 450000);
      expect(response.body).toHaveProperty('percentageUsed', 90);
      expect(response.body).toHaveProperty('status', 'warning');
    });

    it('should show exceeded status when over budget', async () => {
      // Add more spending to exceed budget
      const today = new Date();
      await prisma.shoppingHistory.create({
        data: {
          userId,
          receiptDate: today,
          totalPhpCents: 100000, // ₱1000 (total: 110%)
        },
      });

      const response = await request(app)
        .get('/api/v1/alerts/budget/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('spentThisWeekCents', 550000);
      expect(response.body.percentageUsed).toBeGreaterThanOrEqual(100);
      expect(response.body).toHaveProperty('status', 'exceeded');
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/alerts/budget/status').expect(401);
    });
  });

  describe('POST /api/v1/alerts/check-expiring', () => {
    beforeEach(async () => {
      // Clean up pantry items before each test
      await prisma.pantryItem.deleteMany({
        where: { userId },
      });
    });

    it('should check expiring items and create alerts', async () => {
      // Add pantry items expiring soon
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      await prisma.pantryItem.create({
        data: {
          userId,
          ingredientName: 'milk',
          quantity: 1,
          unit: 'liters',
          category: 'dairy',
          expiryDate: twoDaysFromNow,
        },
      });

      const response = await request(app)
        .post('/api/v1/alerts/check-expiring')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('alertsCreated');
      expect(response.body.alertsCreated).toBeGreaterThanOrEqual(1);
    });

    it('should not create duplicate alerts for same item', async () => {
      // Add pantry item expiring soon
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      await prisma.pantryItem.create({
        data: {
          userId,
          ingredientName: 'yogurt',
          quantity: 1,
          unit: 'pieces',
          category: 'dairy',
          expiryDate: twoDaysFromNow,
        },
      });

      // First check
      const response1 = await request(app)
        .post('/api/v1/alerts/check-expiring')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response1.body.alertsCreated).toBe(1);

      // Second check (should not create duplicate)
      const response2 = await request(app)
        .post('/api/v1/alerts/check-expiring')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response2.body.alertsCreated).toBe(0);
    });

    it('should not create alerts for items not expiring soon', async () => {
      // Add pantry item expiring in 10 days
      const tenDaysFromNow = new Date();
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

      await prisma.pantryItem.create({
        data: {
          userId,
          ingredientName: 'bread',
          quantity: 1,
          unit: 'pieces',
          category: 'grains',
          expiryDate: tenDaysFromNow,
        },
      });

      const response = await request(app)
        .post('/api/v1/alerts/check-expiring')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.alertsCreated).toBe(0);
    });

    it('should require authentication', async () => {
      await request(app).post('/api/v1/alerts/check-expiring').expect(401);
    });
  });

  describe('POST /api/v1/alerts', () => {
    it('should create a new alert', async () => {
      const newAlert = {
        alertType: 'price_spike',
        title: 'Price Alert',
        message: 'Chicken price increased by 20%',
        threshold: 100,
        actualValue: 120,
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newAlert)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('alertType', newAlert.alertType);
      expect(response.body).toHaveProperty('title', newAlert.title);
      expect(response.body).toHaveProperty('message', newAlert.message);
      expect(response.body).toHaveProperty('threshold', newAlert.threshold);
      expect(response.body).toHaveProperty('actualValue', newAlert.actualValue);
      expect(response.body).toHaveProperty('isRead', false);
      expect(response.body).toHaveProperty('createdAt');

      alertId = response.body.id;
    });

    it('should require alertType', async () => {
      const invalidAlert = {
        title: 'Test Alert',
        message: 'Test message',
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidAlert)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Alert type is required');
    });

    it('should validate alertType enum', async () => {
      const invalidAlert = {
        alertType: 'invalid_type',
        title: 'Test Alert',
        message: 'Test message',
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidAlert)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid alert type');
    });

    it('should require authentication', async () => {
      await request(app).post('/api/v1/alerts').expect(401);
    });
  });

  describe('GET /api/v1/alerts', () => {
    it('should get all alerts for user', async () => {
      const response = await request(app)
        .get('/api/v1/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter alerts by type', async () => {
      const response = await request(app)
        .get('/api/v1/alerts?alertType=price_spike')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      response.body.items.forEach((alert: any) => {
        expect(alert.alertType).toBe('price_spike');
      });
    });

    it('should filter alerts by read status', async () => {
      const response = await request(app)
        .get('/api/v1/alerts?isRead=false')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.items.forEach((alert: any) => {
        expect(alert.isRead).toBe(false);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/alerts?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 5);
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/alerts').expect(401);
    });
  });

  describe('GET /api/v1/alerts/stats', () => {
    it('should get alert statistics', async () => {
      const response = await request(app)
        .get('/api/v1/alerts/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalAlerts');
      expect(response.body).toHaveProperty('unreadCount');
      expect(response.body).toHaveProperty('byType');
      expect(response.body).toHaveProperty('recentAlerts');
      expect(typeof response.body.totalAlerts).toBe('number');
      expect(typeof response.body.unreadCount).toBe('number');
      expect(typeof response.body.byType).toBe('object');
      expect(Array.isArray(response.body.recentAlerts)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/alerts/stats').expect(401);
    });
  });

  describe('GET /api/v1/alerts/:id', () => {
    it('should get a single alert by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', alertId);
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent alert', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app)
        .get(`/api/v1/alerts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should validate UUID format', async () => {
      await request(app)
        .get('/api/v1/alerts/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app).get(`/api/v1/alerts/${alertId}`).expect(401);
    });
  });

  describe('PATCH /api/v1/alerts/:id/read', () => {
    it('should mark alert as read', async () => {
      const response = await request(app)
        .patch(`/api/v1/alerts/${alertId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', alertId);
      expect(response.body).toHaveProperty('isRead', true);
      expect(response.body).toHaveProperty('readAt');
    });

    it('should return 404 for non-existent alert', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app)
        .patch(`/api/v1/alerts/${fakeId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app).patch(`/api/v1/alerts/${alertId}/read`).expect(401);
    });
  });

  describe('PATCH /api/v1/alerts/:id/dismiss', () => {
    it('should dismiss alert', async () => {
      const response = await request(app)
        .patch(`/api/v1/alerts/${alertId}/dismiss`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Alert dismissed successfully');
    });

    it('should return 404 for non-existent alert', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app)
        .patch(`/api/v1/alerts/${fakeId}/dismiss`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app).patch(`/api/v1/alerts/${alertId}/dismiss`).expect(401);
    });
  });

  describe('DELETE /api/v1/alerts/:id', () => {
    it('should delete alert', async () => {
      const response = await request(app)
        .delete(`/api/v1/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Alert deleted successfully');

      // Verify alert is deleted
      await request(app)
        .get(`/api/v1/alerts/${alertId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent alert', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app)
        .delete(`/api/v1/alerts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app).delete(`/api/v1/alerts/${alertId}`).expect(401);
    });
  });
});
