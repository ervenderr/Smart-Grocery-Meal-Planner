/**
 * Analytics Tests
 *
 * Tests for analytics and reporting endpoints.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();

describe('Analytics Endpoints', () => {
  const testUser = {
    email: 'analytics-test@example.com',
    password: 'TestPass123',
    firstName: 'Analytics',
    lastName: 'Test',
  };

  let authToken: string;
  let userId: string;

  // Setup: Create test user and sample data
  beforeAll(async () => {
    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send(testUser);

    authToken = response.body.token;
    userId = response.body.user.id;

    // Update user preferences with budget
    await prisma.userPreference.update({
      where: { userId },
      data: {
        budgetPerWeekCents: 500000, // ₱5000
      },
    });

    // Create sample shopping history
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    await prisma.shoppingHistory.createMany({
      data: [
        {
          userId,
          receiptDate: today,
          totalPhpCents: 150000, // ₱1500
        },
        {
          userId,
          receiptDate: lastWeek,
          totalPhpCents: 200000, // ₱2000
        },
        {
          userId,
          receiptDate: twoWeeksAgo,
          totalPhpCents: 180000, // ₱1800
        },
      ],
    });

    // Create sample pantry items with prices
    await prisma.pantryItem.createMany({
      data: [
        {
          userId,
          ingredientName: 'chicken',
          quantity: 2,
          unit: 'kg',
          category: 'meat',
          purchaseDate: today,
          purchasePriceCents: 60000, // ₱600
        },
        {
          userId,
          ingredientName: 'rice',
          quantity: 5,
          unit: 'kg',
          category: 'grains',
          purchaseDate: today,
          purchasePriceCents: 40000, // ₱400
        },
        {
          userId,
          ingredientName: 'vegetables',
          quantity: 3,
          unit: 'kg',
          category: 'vegetables',
          purchaseDate: lastWeek,
          purchasePriceCents: 50000, // ₱500
        },
        {
          userId,
          ingredientName: 'chicken',
          quantity: 1.5,
          unit: 'kg',
          category: 'meat',
          purchaseDate: twoWeeksAgo,
          purchasePriceCents: 45000, // ₱450
        },
      ],
    });
  });

  // Cleanup: Delete test data
  afterAll(async () => {
    await prisma.shoppingHistory.deleteMany({
      where: { userId },
    });
    await prisma.pantryItem.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'analytics-test' } },
    });
  });

  describe('GET /api/v1/analytics/dashboard', () => {
    it('should get analytics dashboard', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('recentTrends');
      expect(response.body).toHaveProperty('topCategories');
      expect(response.body).toHaveProperty('topItems');
      expect(response.body).toHaveProperty('budgetStatus');
      expect(response.body).toHaveProperty('savingsInsights');

      // Verify summary structure
      expect(response.body.summary).toHaveProperty('totalSpentCents');
      expect(response.body.summary).toHaveProperty('averageWeeklySpentCents');
      expect(response.body.summary).toHaveProperty('totalTransactions');
      expect(response.body.summary).toHaveProperty('uniqueItemsPurchased');
      expect(response.body.summary).toHaveProperty('topCategories');
      expect(response.body.summary).toHaveProperty('budgetUtilization');

      // Verify arrays
      expect(Array.isArray(response.body.recentTrends)).toBe(true);
      expect(Array.isArray(response.body.topCategories)).toBe(true);
      expect(Array.isArray(response.body.topItems)).toBe(true);
      expect(Array.isArray(response.body.savingsInsights)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/analytics/dashboard').expect(401);
    });
  });

  describe('GET /api/v1/analytics/spending-trends', () => {
    it('should get spending trends with default parameters', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/spending-trends')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('trends');
      expect(response.body).toHaveProperty('summary');

      expect(Array.isArray(response.body.trends)).toBe(true);
      expect(response.body.summary).toHaveProperty('totalSpentCents');
      expect(response.body.summary).toHaveProperty('averagePerPeriodCents');
      expect(response.body.summary).toHaveProperty('highestSpendingDate');
      expect(response.body.summary).toHaveProperty('lowestSpendingDate');
    });

    it('should support period parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/spending-trends?period=daily')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period).toBe('daily');
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/spending-trends?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.trends.length).toBeLessThanOrEqual(5);
    });

    it('should validate period parameter', async () => {
      await request(app)
        .get('/api/v1/analytics/spending-trends?period=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/analytics/spending-trends').expect(401);
    });
  });

  describe('GET /api/v1/analytics/category-breakdown', () => {
    it('should get category breakdown', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/category-breakdown')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('totalSpentCents');
      expect(response.body).toHaveProperty('dateRange');

      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.dateRange).toHaveProperty('startDate');
      expect(response.body.dateRange).toHaveProperty('endDate');

      // Verify category structure if data exists
      if (response.body.categories.length > 0) {
        const category = response.body.categories[0];
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('totalSpentCents');
        expect(category).toHaveProperty('itemCount');
        expect(category).toHaveProperty('percentage');
      }
    });

    it('should support minAmount filter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/category-breakdown?minAmount=10000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All categories should have totalSpentCents >= 10000
      response.body.categories.forEach((cat: any) => {
        expect(cat.totalSpentCents).toBeGreaterThanOrEqual(10000);
      });
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/analytics/category-breakdown').expect(401);
    });
  });

  describe('GET /api/v1/analytics/top-items', () => {
    it('should get top items by default (spending)', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/top-items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('dateRange');

      expect(Array.isArray(response.body.items)).toBe(true);

      // Verify item structure if data exists
      if (response.body.items.length > 0) {
        const item = response.body.items[0];
        expect(item).toHaveProperty('ingredientName');
        expect(item).toHaveProperty('totalQuantity');
        expect(item).toHaveProperty('totalSpentCents');
        expect(item).toHaveProperty('purchaseCount');
        expect(item).toHaveProperty('averagePriceCents');

        // Verify sorted by spending (default)
        if (response.body.items.length > 1) {
          expect(response.body.items[0].totalSpentCents).toBeGreaterThanOrEqual(
            response.body.items[1].totalSpentCents
          );
        }
      }
    });

    it('should support sortBy=quantity parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/top-items?sortBy=quantity')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.items.length > 1) {
        expect(response.body.items[0].totalQuantity).toBeGreaterThanOrEqual(
          response.body.items[1].totalQuantity
        );
      }
    });

    it('should support sortBy=frequency parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/top-items?sortBy=frequency')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.items.length > 1) {
        expect(response.body.items[0].purchaseCount).toBeGreaterThanOrEqual(
          response.body.items[1].purchaseCount
        );
      }
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/top-items?limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(2);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/analytics/top-items').expect(401);
    });
  });

  describe('GET /api/v1/analytics/budget-comparison', () => {
    it('should get budget comparison', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/budget-comparison')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('comparisons');
      expect(response.body).toHaveProperty('summary');

      expect(Array.isArray(response.body.comparisons)).toBe(true);
      expect(response.body.summary).toHaveProperty('averageUtilization');
      expect(response.body.summary).toHaveProperty('periodsOverBudget');
      expect(response.body.summary).toHaveProperty('totalPeriodsAnalyzed');

      // Verify comparison structure if data exists
      if (response.body.comparisons.length > 0) {
        const comparison = response.body.comparisons[0];
        expect(comparison).toHaveProperty('period');
        expect(comparison).toHaveProperty('budgetCents');
        expect(comparison).toHaveProperty('actualSpentCents');
        expect(comparison).toHaveProperty('differenceCents');
        expect(comparison).toHaveProperty('percentageUsed');
        expect(comparison).toHaveProperty('status');
        expect(['under_budget', 'on_budget', 'over_budget']).toContain(comparison.status);
      }
    });

    it('should support period parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/budget-comparison?period=monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.comparisons.length).toBeGreaterThan(0);
    });

    it('should support count parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/budget-comparison?count=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.comparisons.length).toBeLessThanOrEqual(2);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/analytics/budget-comparison').expect(401);
    });
  });

  describe('GET /api/v1/analytics/price-trends', () => {
    it('should get price trends', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/price-trends')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ingredients');
      expect(response.body).toHaveProperty('dateRange');

      expect(Array.isArray(response.body.ingredients)).toBe(true);

      // Verify ingredient trend structure if data exists
      if (response.body.ingredients.length > 0) {
        const ingredient = response.body.ingredients[0];
        expect(ingredient).toHaveProperty('ingredientName');
        expect(ingredient).toHaveProperty('trends');
        expect(ingredient).toHaveProperty('overallChange');
        expect(ingredient).toHaveProperty('overallChangePercentage');

        expect(Array.isArray(ingredient.trends)).toBe(true);
        if (ingredient.trends.length > 0) {
          expect(ingredient.trends[0]).toHaveProperty('date');
          expect(ingredient.trends[0]).toHaveProperty('averagePriceCents');
        }
      }
    });

    it('should support ingredientName filter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/price-trends?ingredientName=chicken')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.ingredients.length > 0) {
        expect(response.body.ingredients[0].ingredientName).toBe('chicken');
      }
    });

    it('should support period parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/price-trends?period=monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ingredients');
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/analytics/price-trends').expect(401);
    });
  });

  describe('GET /api/v1/analytics/savings-insights', () => {
    it('should get savings insights', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/savings-insights')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('insights');
      expect(response.body).toHaveProperty('totalSavingsCents');
      expect(response.body).toHaveProperty('dateRange');

      expect(Array.isArray(response.body.insights)).toBe(true);

      // Verify insight structure if data exists
      if (response.body.insights.length > 0) {
        const insight = response.body.insights[0];
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('title');
        expect(insight).toHaveProperty('description');
        expect(insight).toHaveProperty('amountSavedCents');
        expect(['price_drop', 'budget_savings', 'bulk_savings', 'seasonal']).toContain(insight.type);
      }
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/analytics/savings-insights').expect(401);
    });
  });
});
