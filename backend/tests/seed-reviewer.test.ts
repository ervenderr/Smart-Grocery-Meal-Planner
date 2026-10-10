/**
 * Reviewer seed tests: guards, password rules, idempotency, consent state.
 */

import { randomBytes } from 'crypto';
import { prisma } from '../src/config/database.config';
import { comparePassword } from '../src/utils/password.util';
import {
  assertSafeToSeed,
  validateReviewerPassword,
  seedReviewer,
} from '../src/tools/reviewer-seed';

const LOCAL_URL = 'postgresql://u@localhost:5432/db';
const REMOTE_URL = 'postgresql://u@db.railway.internal/db';

describe('assertSafeToSeed', () => {
  it('refuses production', () => {
    expect(() =>
      assertSafeToSeed({ NODE_ENV: 'production', DATABASE_URL: LOCAL_URL })
    ).toThrow(/production/);
  });

  it('refuses a non-local database', () => {
    expect(() =>
      assertSafeToSeed({ NODE_ENV: 'development', DATABASE_URL: REMOTE_URL })
    ).toThrow(/not look local/);
  });

  it('allows a remote database with ALLOW_SEED=true', () => {
    expect(() =>
      assertSafeToSeed({
        NODE_ENV: 'development',
        DATABASE_URL: REMOTE_URL,
        ALLOW_SEED: 'true',
      })
    ).not.toThrow();
  });

  it('allows a local database', () => {
    expect(() =>
      assertSafeToSeed({ NODE_ENV: 'development', DATABASE_URL: LOCAL_URL })
    ).not.toThrow();
  });

  it('still refuses production when ALLOW_SEED=true', () => {
    expect(() =>
      assertSafeToSeed({
        NODE_ENV: 'production',
        DATABASE_URL: LOCAL_URL,
        ALLOW_SEED: 'true',
      })
    ).toThrow(/production/);
  });
});

describe('validateReviewerPassword', () => {
  it('requires a value', () => {
    expect(() => validateReviewerPassword(undefined)).toThrow(/REVIEWER_PASSWORD/);
  });

  it('rejects weak passwords', () => {
    expect(() => validateReviewerPassword('short')).toThrow(/REVIEWER_PASSWORD/);
    expect(() => validateReviewerPassword('NoDigitsHere')).toThrow(/REVIEWER_PASSWORD/);
    expect(() => validateReviewerPassword('alllower123')).toThrow(/REVIEWER_PASSWORD/);
    expect(() => validateReviewerPassword('ALLUPPER123')).toThrow(/REVIEWER_PASSWORD/);
  });

  it('accepts a strong password', () => {
    expect(validateReviewerPassword('Review2026Demo')).toBe('Review2026Demo');
  });
});

describe('seedReviewer', () => {
  const email = `reviewer-${randomBytes(6).toString('hex')}@example.com`;
  const password = 'Review2026Demo';

  async function countsFor(userId: string) {
    const [pantry, recipes, plans, planItems, lists, listItems] = await Promise.all([
      prisma.pantryItem.count({ where: { userId } }),
      prisma.recipe.count({ where: { userId } }),
      prisma.mealPlan.count({ where: { userId } }),
      prisma.mealPlanItem.count({ where: { mealPlan: { userId } } }),
      prisma.shoppingList.count({ where: { userId } }),
      prisma.shoppingListItem.count({ where: { shoppingList: { userId } } }),
    ]);
    return { pantry, recipes, plans, planItems, lists, listItems };
  }

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.mealPlanItem.deleteMany({ where: { mealPlan: { userId: user.id } } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  it('is idempotent and leaves consent unset with onboarding complete', async () => {
    await seedReviewer(prisma, { email, password });
    const user1 = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { preferences: true },
    });
    const first = await countsFor(user1.id);

    await seedReviewer(prisma, { email, password });
    const user2 = await prisma.user.findUniqueOrThrow({ where: { email } });
    const second = await countsFor(user2.id);

    expect(user2.id).toBe(user1.id);
    expect(second).toEqual(first);
    Object.values(first).forEach((n) => expect(n).toBeGreaterThan(0));

    expect(user1.aiConsentAt).toBeNull();
    expect(user1.aiConsentVersion).toBeNull();
    expect(user1.preferences?.onboardingCompletedAt).not.toBeNull();
    expect(await comparePassword(password, user1.passwordHash)).toBe(true);
  });

  it('updates the password hash on re-run and resets consent', async () => {
    const next = 'Another2026Demo';
    await prisma.user.update({
      where: { email },
      data: { aiConsentAt: new Date(), aiConsentVersion: 1 },
    });
    await seedReviewer(prisma, { email, password: next });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await comparePassword(next, user.passwordHash)).toBe(true);
    expect(await comparePassword(password, user.passwordHash)).toBe(false);
    expect(user.aiConsentAt).toBeNull();
  });

  it('does not touch other users data', async () => {
    const other = await prisma.user.create({
      data: {
        email: `other-${randomBytes(6).toString('hex')}@example.com`,
        passwordHash: 'x',
      },
    });
    try {
      await prisma.pantryItem.create({
        data: { userId: other.id, ingredientName: 'rice', quantity: 1, unit: 'kg', category: 'grains' },
      });
      await seedReviewer(prisma, { email, password });
      expect(await prisma.pantryItem.count({ where: { userId: other.id } })).toBe(1);
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });

  it('refuses to wipe an existing real (non-reviewer) account', async () => {
    const realEmail = `real-${randomBytes(6).toString('hex')}@example.com`;
    const real = await prisma.user.create({
      data: { email: realEmail, passwordHash: 'x', firstName: 'Real', lastName: 'Person' },
    });
    try {
      await prisma.pantryItem.create({
        data: { userId: real.id, ingredientName: 'rice', quantity: 1, unit: 'kg', category: 'grains' },
      });
      await expect(seedReviewer(prisma, { email: realEmail, password })).rejects.toThrow(
        /non-reviewer account/
      );
      expect(await prisma.pantryItem.count({ where: { userId: real.id } })).toBe(1);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: real.id } });
      expect(after.passwordHash).toBe('x');
    } finally {
      await prisma.user.delete({ where: { id: real.id } });
    }
  });
});
