/**
 * Reviewer demo seed (App Store / Play review account).
 *
 * Pure module: no top-level side effects. The CLI lives in scripts/seed-reviewer.ts.
 * The reviewer is left WITHOUT AI consent on every run so App Review sees the
 * consent flow. Onboarding is marked complete so they land on populated screens.
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password.util';

export const REVIEWER_DEFAULT_EMAIL = 'app-review@kitcha-demo.com';

const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]', 'postgres', 'db'];

function looksLocal(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    const host = new URL(databaseUrl).hostname;
    return LOCAL_HOSTS.includes(host) || host === '';
  } catch {
    return false;
  }
}

export function assertSafeToSeed(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV=production');
  }
  if (env.ALLOW_SEED !== 'true' && !looksLocal(env.DATABASE_URL)) {
    throw new Error(
      'Refusing to seed: DATABASE_URL does not look local (set ALLOW_SEED=true to override)'
    );
  }
}

export function validateReviewerPassword(pw: string | undefined): string {
  if (!pw) {
    throw new Error('REVIEWER_PASSWORD is required');
  }
  const ok = pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw);
  if (!ok) {
    throw new Error(
      'REVIEWER_PASSWORD must be at least 8 characters with an uppercase letter, a lowercase letter and a digit'
    );
  }
  return pw;
}

interface SamplePantry {
  readonly ingredientName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly category: string;
  readonly location: string;
  readonly expiresInDays: number | null;
}

const PANTRY: readonly SamplePantry[] = [
  { ingredientName: 'eggs', quantity: 12, unit: 'pieces', category: 'protein', location: 'fridge', expiresInDays: 3 },
  { ingredientName: 'milk', quantity: 1, unit: 'l', category: 'dairy', location: 'fridge', expiresInDays: 2 },
  { ingredientName: 'spinach', quantity: 200, unit: 'grams', category: 'vegetable', location: 'fridge', expiresInDays: 1 },
  { ingredientName: 'chicken thighs', quantity: 1, unit: 'kg', category: 'protein', location: 'freezer', expiresInDays: 30 },
  { ingredientName: 'white rice', quantity: 2, unit: 'kg', category: 'grains', location: 'pantry', expiresInDays: null },
  { ingredientName: 'olive oil', quantity: 500, unit: 'ml', category: 'other', location: 'pantry', expiresInDays: null },
  { ingredientName: 'cherry tomatoes', quantity: 300, unit: 'grams', category: 'vegetable', location: 'fridge', expiresInDays: 5 },
  { ingredientName: 'black beans', quantity: 2, unit: 'cups', category: 'grains', location: 'pantry', expiresInDays: 365 },
];

interface SampleIngredient {
  readonly ingredientName: string;
  readonly quantity: number;
  readonly unit: string;
}

interface SampleRecipe {
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly difficulty: string;
  readonly prepTimeMinutes: number;
  readonly cookTimeMinutes: number;
  readonly servings: number;
  readonly ingredientsList: readonly SampleIngredient[];
  readonly instructions: readonly string[];
  readonly tags: readonly string[];
  readonly dietaryRestrictions: readonly string[];
}

const RECIPES: readonly SampleRecipe[] = [
  {
    title: 'Classic Scrambled Eggs',
    description: 'Fluffy scrambled eggs for a quick breakfast.',
    category: 'breakfast',
    difficulty: 'easy',
    prepTimeMinutes: 5,
    cookTimeMinutes: 5,
    servings: 2,
    ingredientsList: [
      { ingredientName: 'eggs', quantity: 4, unit: 'pieces' },
      { ingredientName: 'milk', quantity: 2, unit: 'tbsp' },
      { ingredientName: 'butter', quantity: 1, unit: 'tbsp' },
    ],
    instructions: [
      'Whisk eggs with milk, salt and pepper.',
      'Melt butter in a pan over medium-low heat.',
      'Stir gently until just set and serve.',
    ],
    tags: ['quick', 'breakfast'],
    dietaryRestrictions: ['vegetarian'],
  },
  {
    title: 'One-Pot Chicken and Rice',
    description: 'A comforting one-pot dinner.',
    category: 'dinner',
    difficulty: 'medium',
    prepTimeMinutes: 10,
    cookTimeMinutes: 35,
    servings: 4,
    ingredientsList: [
      { ingredientName: 'chicken thighs', quantity: 700, unit: 'grams' },
      { ingredientName: 'white rice', quantity: 300, unit: 'grams' },
      { ingredientName: 'chicken broth', quantity: 600, unit: 'ml' },
    ],
    instructions: [
      'Sear the chicken until golden, then set aside.',
      'Toast the rice in the pot, add broth and bring to a boil.',
      'Return the chicken, cover and simmer for 25 minutes.',
    ],
    tags: ['one-pot', 'family-friendly'],
    dietaryRestrictions: [],
  },
  {
    title: 'Spinach and Tomato Rice Bowl',
    description: 'Use up fresh spinach and tomatoes with leftover rice.',
    category: 'lunch',
    difficulty: 'easy',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    servings: 2,
    ingredientsList: [
      { ingredientName: 'white rice', quantity: 200, unit: 'grams' },
      { ingredientName: 'spinach', quantity: 150, unit: 'grams' },
      { ingredientName: 'cherry tomatoes', quantity: 150, unit: 'grams' },
    ],
    instructions: [
      'Saute spinach and halved tomatoes in olive oil.',
      'Fold into warm rice and season to taste.',
    ],
    tags: ['vegetarian', 'use-it-up'],
    dietaryRestrictions: ['vegetarian', 'vegan'],
  },
];

interface SampleListItem {
  readonly itemName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly category: string;
  readonly costEstimateCents: number;
}

const SHOPPING_ITEMS: readonly SampleListItem[] = [
  { itemName: 'butter', quantity: 1, unit: 'pieces', category: 'dairy', costEstimateCents: 9500 },
  { itemName: 'chicken broth', quantity: 1, unit: 'l', category: 'other', costEstimateCents: 6000 },
  { itemName: 'bananas', quantity: 6, unit: 'pieces', category: 'fruit', costEstimateCents: 4500 },
  { itemName: 'whole wheat bread', quantity: 1, unit: 'pieces', category: 'grains', costEstimateCents: 7000 },
  { itemName: 'garlic', quantity: 1, unit: 'pieces', category: 'vegetable', costEstimateCents: 2000 },
];

// [recipe index, day of week (0=Monday), meal type]
const PLAN_SLOTS: ReadonlyArray<readonly [number, number, string]> = [
  [0, 0, 'breakfast'],
  [1, 0, 'dinner'],
  [0, 2, 'breakfast'],
  [1, 4, 'dinner'],
];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeekUtc(now: Date): Date {
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
}

export interface SeedReviewerInput {
  readonly email: string;
  readonly password: string;
}

export interface SeedReviewerResult {
  readonly email: string;
  readonly pantryItems: number;
  readonly recipes: number;
  readonly shoppingListItems: number;
  readonly mealPlanItems: number;
}

export async function seedReviewer(
  prisma: PrismaClient,
  { email, password }: SeedReviewerInput
): Promise<SeedReviewerResult> {
  const passwordHash = await hashPassword(password);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      firstName: 'App',
      lastName: 'Reviewer',
      isActive: true,
      aiConsentAt: null,
      aiConsentVersion: null,
    },
    update: {
      passwordHash,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      aiConsentAt: null,
      aiConsentVersion: null,
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, currency: 'PHP', onboardingCompletedAt: now },
    update: { currency: 'PHP', onboardingCompletedAt: now },
  });

  const weekStart = startOfWeekUtc(now);
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
  const userId = user.id;

  return prisma.$transaction(async (tx) => {
    // Child-first order avoids the meal_plan_items.recipe_id RESTRICT FK.
    await tx.mealPlanItem.deleteMany({ where: { mealPlan: { userId } } });
    await tx.mealPlan.deleteMany({ where: { userId } });
    await tx.shoppingList.deleteMany({ where: { userId } });
    await tx.recipe.deleteMany({ where: { userId } });
    await tx.pantryItem.deleteMany({ where: { userId } });

    await tx.pantryItem.createMany({
      data: PANTRY.map((p) => ({
        userId,
        ingredientName: p.ingredientName,
        quantity: p.quantity,
        unit: p.unit,
        category: p.category,
        location: p.location,
        expiryDate:
          p.expiresInDays === null ? null : new Date(now.getTime() + p.expiresInDays * DAY_MS),
      })),
    });

    const recipes: Array<{ id: string }> = [];
    for (const r of RECIPES) {
      recipes.push(
        await tx.recipe.create({
          data: {
            userId,
            title: r.title,
            description: r.description,
            category: r.category,
            difficulty: r.difficulty,
            prepTimeMinutes: r.prepTimeMinutes,
            cookTimeMinutes: r.cookTimeMinutes,
            servings: r.servings,
            ingredientsList: r.ingredientsList.map((i) => ({ ...i })),
            instructions: [...r.instructions],
            tags: [...r.tags],
            dietaryRestrictions: [...r.dietaryRestrictions],
            source: 'local',
          },
        })
      );
    }

    await tx.shoppingList.create({
      data: {
        userId,
        name: 'Weekly groceries',
        shoppingListItems: {
          create: SHOPPING_ITEMS.map((i) => ({ ...i })),
        },
      },
    });

    await tx.mealPlan.create({
      data: {
        userId,
        name: 'This week',
        startDate: weekStart,
        endDate: weekEnd,
        mealPlanItems: {
          create: PLAN_SLOTS.map(([recipeIdx, dayOfWeek, mealType]) => ({
            recipeId: recipes[recipeIdx].id,
            dayOfWeek,
            mealType,
            servings: RECIPES[recipeIdx].servings,
          })),
        },
      },
    });

    return {
      email,
      pantryItems: PANTRY.length,
      recipes: RECIPES.length,
      shoppingListItems: SHOPPING_ITEMS.length,
      mealPlanItems: PLAN_SLOTS.length,
    };
  });
}
