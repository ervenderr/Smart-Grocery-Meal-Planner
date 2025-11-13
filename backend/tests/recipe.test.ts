/**
 * Recipe Tests
 *
 * Tests for recipe management endpoints.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();

describe('Recipe Endpoints', () => {
  const testUser = {
    email: 'recipe-test@example.com',
    password: 'TestPass123',
    firstName: 'Recipe',
    lastName: 'Test',
  };

  let authToken: string;
  let userId: string;
  let recipeId: string;

  // Setup: Create test user
  beforeAll(async () => {
    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send(testUser);

    authToken = response.body.token;
    userId = response.body.user.id;
  });

  // Cleanup: Delete test user and recipes
  afterAll(async () => {
    await prisma.recipe.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'recipe-test' } },
    });
  });

  describe('POST /api/v1/recipes', () => {
    it('should create a new recipe', async () => {
      const newRecipe = {
        name: 'Test Pasta',
        description: 'A delicious test pasta recipe',
        category: 'dinner',
        difficulty: 'medium',
        prepTimeMinutes: 15,
        cookTimeMinutes: 20,
        servings: 4,
        ingredients: [
          { ingredientName: 'pasta', quantity: 1, unit: 'lbs' },
          { ingredientName: 'tomato sauce', quantity: 2, unit: 'cups' },
        ],
        instructions: ['Boil pasta', 'Add sauce', 'Serve hot'],
        tags: ['italian', 'pasta'],
        dietaryRestrictions: ['vegetarian'],
      };

      const response = await request(app)
        .post('/api/v1/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newRecipe)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toMatchObject({
        name: newRecipe.name,
        category: newRecipe.category,
        difficulty: newRecipe.difficulty,
        prepTimeMinutes: newRecipe.prepTimeMinutes,
        cookTimeMinutes: newRecipe.cookTimeMinutes,
        servings: newRecipe.servings,
      });
      expect(response.body.totalTimeMinutes).toBe(35);

      recipeId = response.body.id;
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/recipes')
        .send({
          name: 'Test',
          category: 'breakfast',
          difficulty: 'easy',
          prepTimeMinutes: 10,
          cookTimeMinutes: 5,
          servings: 2,
          ingredients: [{ ingredientName: 'eggs', quantity: 2, unit: 'pieces' }],
          instructions: ['Cook eggs'],
        })
        .expect(401);
    });

    it('should reject invalid category', async () => {
      const response = await request(app)
        .post('/api/v1/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
          category: 'invalid-category',
          difficulty: 'easy',
          prepTimeMinutes: 10,
          cookTimeMinutes: 5,
          servings: 2,
          ingredients: [{ ingredientName: 'test', quantity: 1, unit: 'cups' }],
          instructions: ['Test'],
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/v1/recipes', () => {
    it('should return all recipes', async () => {
      const response = await request(app)
        .get('/api/v1/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/v1/recipes?category=dinner')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((item: any) => item.category === 'dinner')).toBe(true);
    });

    it('should filter by difficulty', async () => {
      const response = await request(app)
        .get('/api/v1/recipes?difficulty=medium')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((item: any) => item.difficulty === 'medium')).toBe(true);
    });

    it('should search by name', async () => {
      const response = await request(app)
        .get('/api/v1/recipes?search=Pasta')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/recipes?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
      });
      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/recipes/:id', () => {
    it('should return a single recipe', async () => {
      const response = await request(app)
        .get(`/api/v1/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', recipeId);
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for non-existent recipe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/recipes/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PATCH /api/v1/recipes/:id', () => {
    it('should update recipe', async () => {
      const updates = {
        servings: 6,
        description: 'Updated description',
      };

      const response = await request(app)
        .patch(`/api/v1/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        id: recipeId,
        servings: updates.servings,
        description: updates.description,
      });
    });

    it('should return 404 for non-existent recipe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .patch(`/api/v1/recipes/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ servings: 2 })
        .expect(404);
    });
  });

  describe('GET /api/v1/recipes/stats', () => {
    it('should return recipe statistics', async () => {
      const response = await request(app)
        .get('/api/v1/recipes/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalRecipes');
      expect(response.body).toHaveProperty('byCategory');
      expect(response.body).toHaveProperty('byDifficulty');
      expect(response.body).toHaveProperty('averagePrepTime');
      expect(response.body).toHaveProperty('averageCookTime');
      expect(typeof response.body.totalRecipes).toBe('number');
    });
  });

  describe('DELETE /api/v1/recipes/:id', () => {
    it('should delete a recipe', async () => {
      const response = await request(app)
        .delete(`/api/v1/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify recipe is deleted (soft delete)
      await request(app)
        .get(`/api/v1/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent recipe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .delete(`/api/v1/recipes/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
