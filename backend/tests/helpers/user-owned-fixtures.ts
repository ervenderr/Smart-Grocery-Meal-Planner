/**
 * Fixtures and counters for every Prisma model that is owned by a User.
 * Used by account-deletion tests (including the DMMF completeness check).
 */

import { createHash, randomUUID } from 'crypto';
import { prisma } from '../../src/config/database.config';

type Factory = (userId: string) => Promise<void>;
type Counter = (userId: string) => Promise<number>;

const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = new Date(new Date().toISOString().slice(0, 10));

async function createRecipe(userId: string) {
  return prisma.recipe.create({
    data: {
      userId,
      title: 'Deletion fixture recipe',
      category: 'dinner',
      difficulty: 'easy',
      ingredientsList: [{ ingredientName: 'rice', quantity: 1, unit: 'cups' }],
      instructions: ['Cook'],
    },
  });
}

export const OWNED_MODEL_FACTORIES: Readonly<Record<string, Factory>> = {
  UserPreference: async (userId) => {
    await prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  },
  PantryItem: async (userId) => {
    await prisma.pantryItem.create({
      data: { userId, ingredientName: 'rice', quantity: 2, unit: 'kg', category: 'grains' },
    });
  },
  Recipe: async (userId) => {
    await createRecipe(userId);
  },
  MealPlan: async (userId) => {
    // RESTRICT regression: the plan item references a recipe owned by the same user.
    const recipe = await createRecipe(userId);
    await prisma.mealPlan.create({
      data: {
        userId,
        name: 'Deletion fixture plan',
        startDate: TODAY,
        endDate: TODAY,
        mealPlanItems: {
          create: [{ recipeId: recipe.id, dayOfWeek: 0, mealType: 'dinner' }],
        },
      },
    });
  },
  ShoppingList: async (userId) => {
    await prisma.shoppingList.create({
      data: {
        userId,
        name: 'Deletion fixture list',
        shoppingListItems: { create: [{ itemName: 'milk', quantity: 1, unit: 'l' }] },
      },
    });
  },
  ShoppingHistory: async (userId) => {
    await prisma.shoppingHistory.create({
      data: { userId, receiptDate: TODAY, totalPhpCents: 1000 },
    });
  },
  Notification: async (userId) => {
    await prisma.notification.create({
      data: { userId, notificationType: 'low_stock', title: 't', message: 'm' },
    });
  },
  Alert: async (userId) => {
    await prisma.alert.create({
      data: { userId, alertType: 'budget_warning', title: 't', message: 'm' },
    });
  },
  ZapierWebhook: async (userId) => {
    await prisma.zapierWebhook.create({
      data: { userId, eventType: 'stock_low', webhookUrl: 'https://example.com/hook' },
    });
  },
  AiReport: async (userId) => {
    await prisma.aiReport.create({
      data: { userId, kind: 'recipe', reason: 'inaccurate' },
    });
  },
  RefreshToken: async (userId) => {
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });
  },
  IdempotencyKey: async (userId) => {
    await prisma.idempotencyKey.create({
      data: {
        userId,
        key: `fixture-${randomUUID()}`,
        method: 'POST',
        route: '/api/v1/pantry',
        requestHash: createHash('sha256').update(randomUUID()).digest('hex'),
        status: 'completed',
        responseStatus: 201,
        responseBody: { ok: true },
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });
  },
};

export const OWNED_MODEL_COUNTERS: Readonly<Record<string, Counter>> = {
  UserPreference: (userId) => prisma.userPreference.count({ where: { userId } }),
  PantryItem: (userId) => prisma.pantryItem.count({ where: { userId } }),
  Recipe: (userId) => prisma.recipe.count({ where: { userId } }),
  MealPlan: (userId) => prisma.mealPlan.count({ where: { userId } }),
  MealPlanItem: (userId) => prisma.mealPlanItem.count({ where: { mealPlan: { userId } } }),
  ShoppingList: (userId) => prisma.shoppingList.count({ where: { userId } }),
  ShoppingListItem: (userId) =>
    prisma.shoppingListItem.count({ where: { shoppingList: { userId } } }),
  ShoppingHistory: (userId) => prisma.shoppingHistory.count({ where: { userId } }),
  Notification: (userId) => prisma.notification.count({ where: { userId } }),
  Alert: (userId) => prisma.alert.count({ where: { userId } }),
  ZapierWebhook: (userId) => prisma.zapierWebhook.count({ where: { userId } }),
  AiReport: (userId) => prisma.aiReport.count({ where: { userId } }),
  RefreshToken: (userId) => prisma.refreshToken.count({ where: { userId } }),
  IdempotencyKey: (userId) => prisma.idempotencyKey.count({ where: { userId } }),
};

/** Insert the user's ai_usage row and make sure today's global row exists. */
export async function seedAiUsage(userId: string): Promise<void> {
  await prisma.aiUsage.upsert({
    where: { scope_day: { scope: `user:${userId}`, day: TODAY } },
    update: {},
    create: { scope: `user:${userId}`, day: TODAY, count: 1 },
  });
  await prisma.aiUsage.upsert({
    where: { scope_day: { scope: 'global', day: TODAY } },
    update: {},
    create: { scope: 'global', day: TODAY, count: 1 },
  });
}

export function countAiUsage(userId: string): Promise<number> {
  return prisma.aiUsage.count({ where: { scope: `user:${userId}` } });
}

export function countGlobalAiUsage(): Promise<number> {
  return prisma.aiUsage.count({ where: { scope: 'global' } });
}
