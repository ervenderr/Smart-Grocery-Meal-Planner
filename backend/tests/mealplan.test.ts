/**
 * Meal Plan Tests
 *
 * Tests for meal plan management endpoints.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();

describe('Meal Plan Endpoints', () => {
  const testUser = {
    email: 'mealplan-test@example.com',
    password: 'TestPass123',
    firstName: 'MealPlan',
    lastName: 'Test',
  };

  let authToken: string;
  let userId: string;
  let recipeId1: string;
  let recipeId2: string;
  let mealPlanId: string;

  // Setup: Create test user and recipes
  beforeAll(async () => {
    // Create user
    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send(testUser);

    authToken = response.body.token;
    userId = response.body.user.id;

    // Create test recipes
    const recipe1 = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Breakfast Oatmeal',
        description: 'Healthy breakfast',
        category: 'breakfast',
        difficulty: 'easy',
        prepTimeMinutes: 5,
        cookTimeMinutes: 10,
        servings: 2,
        ingredients: [
          { ingredientName: 'oats', quantity: 1, unit: 'cups' },
          { ingredientName: 'milk', quantity: 2, unit: 'cups' },
        ],
        instructions: ['Boil milk', 'Add oats', 'Cook for 10 minutes'],
      });

    recipeId1 = recipe1.body.id;

    const recipe2 = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Chicken Salad',
        description: 'Healthy lunch',
        category: 'lunch',
        difficulty: 'medium',
        prepTimeMinutes: 15,
        cookTimeMinutes: 20,
        servings: 4,
        ingredients: [
          { ingredientName: 'chicken', quantity: 1, unit: 'lbs' },
          { ingredientName: 'lettuce', quantity: 2, unit: 'cups' },
        ],
        instructions: ['Cook chicken', 'Chop lettuce', 'Mix together'],
      });

    recipeId2 = recipe2.body.id;
  });

  // Cleanup: Delete test data
  afterAll(async () => {
    await prisma.mealPlan.deleteMany({
      where: { userId },
    });
    await prisma.recipe.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'mealplan-test' } },
    });
  });

  describe('POST /api/v1/mealplans', () => {
    it('should create a new meal plan', async () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const newMealPlan = {
        name: 'Test Week Plan',
        startDate: today.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0],
        notes: 'Test meal plan',
        meals: [
          {
            recipeId: recipeId1,
            dayOfWeek: 0,
            mealType: 'breakfast',
            servings: 2,
          },
          {
            recipeId: recipeId2,
            dayOfWeek: 0,
            mealType: 'lunch',
            servings: 4,
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/mealplans')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newMealPlan)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toMatchObject({
        name: newMealPlan.name,
        startDate: newMealPlan.startDate,
        endDate: newMealPlan.endDate,
        notes: newMealPlan.notes,
      });
      expect(response.body.meals).toHaveLength(2);
      expect(response.body.meals[0]).toHaveProperty('recipe');
      expect(response.body.meals[0].recipe).toHaveProperty('name');

      mealPlanId = response.body.id;
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/mealplans')
        .send({
          name: 'Test',
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          meals: [],
        })
        .expect(401);
    });

    it('should validate date range', async () => {
      const response = await request(app)
        .post('/api/v1/mealplans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
          startDate: '2025-01-07',
          endDate: '2025-01-01', // End before start
          meals: [
            {
              recipeId: recipeId1,
              dayOfWeek: 0,
              mealType: 'breakfast',
            },
          ],
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Start date must be before end date');
    });

    it('should reject invalid meal type', async () => {
      const response = await request(app)
        .post('/api/v1/mealplans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          meals: [
            {
              recipeId: recipeId1,
              dayOfWeek: 0,
              mealType: 'invalid-type',
            },
          ],
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject invalid day of week', async () => {
      const response = await request(app)
        .post('/api/v1/mealplans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          meals: [
            {
              recipeId: recipeId1,
              dayOfWeek: 7, // Invalid
              mealType: 'breakfast',
            },
          ],
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/v1/mealplans', () => {
    it('should return all meal plans', async () => {
      const response = await request(app)
        .get('/api/v1/mealplans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/v1/mealplans?startDate=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThanOrEqual(0);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/mealplans?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
      });
      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/mealplans/:id', () => {
    it('should return a single meal plan', async () => {
      const response = await request(app)
        .get(`/api/v1/mealplans/${mealPlanId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', mealPlanId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('meals');
      expect(response.body.meals[0]).toHaveProperty('recipe');
    });

    it('should return 404 for non-existent meal plan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/mealplans/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PATCH /api/v1/mealplans/:id', () => {
    it('should update meal plan', async () => {
      const updates = {
        name: 'Updated Plan Name',
        isFavorite: true,
      };

      const response = await request(app)
        .patch(`/api/v1/mealplans/${mealPlanId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        id: mealPlanId,
        name: updates.name,
        isFavorite: updates.isFavorite,
      });
    });

    it('should update meal plan meals', async () => {
      const updates = {
        meals: [
          {
            recipeId: recipeId1,
            dayOfWeek: 1,
            mealType: 'breakfast',
            servings: 1,
          },
        ],
      };

      const response = await request(app)
        .patch(`/api/v1/mealplans/${mealPlanId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.meals).toHaveLength(1);
      expect(response.body.meals[0]).toMatchObject({
        dayOfWeek: 1,
        mealType: 'breakfast',
        servings: 1,
      });
    });

    it('should return 404 for non-existent meal plan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .patch(`/api/v1/mealplans/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(404);
    });
  });

  describe('GET /api/v1/mealplans/stats', () => {
    it('should return meal plan statistics', async () => {
      const response = await request(app)
        .get('/api/v1/mealplans/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalMealPlans');
      expect(response.body).toHaveProperty('averageCostCents');
      expect(response.body).toHaveProperty('averageCalories');
      expect(response.body).toHaveProperty('mealsByType');
      expect(response.body).toHaveProperty('favoriteRecipes');
      expect(typeof response.body.totalMealPlans).toBe('number');
      expect(Array.isArray(response.body.favoriteRecipes)).toBe(true);
    });
  });

  describe('GET /api/v1/mealplans/:id/shopping-list', () => {
    it('should generate shopping list from meal plan', async () => {
      const response = await request(app)
        .get(`/api/v1/mealplans/${mealPlanId}/shopping-list`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0]).toHaveProperty('ingredientName');
      expect(response.body.items[0]).toHaveProperty('quantity');
      expect(response.body.items[0]).toHaveProperty('unit');
      expect(response.body.items[0]).toHaveProperty('recipes');
      expect(Array.isArray(response.body.items[0].recipes)).toBe(true);
    });

    it('should return 404 for non-existent meal plan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/api/v1/mealplans/${fakeId}/shopping-list`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/mealplans/:id', () => {
    it('should delete a meal plan', async () => {
      const response = await request(app)
        .delete(`/api/v1/mealplans/${mealPlanId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify meal plan is deleted (soft delete)
      await request(app)
        .get(`/api/v1/mealplans/${mealPlanId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent meal plan', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .delete(`/api/v1/mealplans/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
