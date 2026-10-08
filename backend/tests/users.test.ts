/**
 * Users Tests
 *
 * Tests for user profile and preferences endpoints.
 *
 * WHAT WE'RE TESTING:
 * - Get profile
 * - Update profile
 * - Get preferences
 * - Update preferences
 * - Change password
 * - Deactivate account
 */

import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/database.config";

const app = createApp();

describe("Users Endpoints", () => {
  const testUser = {
    email: "users-test@example.com",
    password: "TestPass123",
    firstName: "Users",
    lastName: "Test",
  };

  let authToken: string;
  let userId: string;

  // Setup: Create test user
  beforeAll(async () => {
    const response = await request(app)
      .post("/api/v1/auth/signup")
      .send(testUser);

    authToken = response.body.token;
    userId = response.body.user.id;
  });

  // Cleanup: Delete test user
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: "users-test" } },
    });
  });

  describe("GET /api/v1/users/profile", () => {
    it("should return user profile", async () => {
      const response = await request(app)
        .get("/api/v1/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        isActive: true,
      });

      expect(response.body).toHaveProperty("createdAt");
      expect(response.body).toHaveProperty("lastLogin");
    });

    it("should require authentication", async () => {
      await request(app).get("/api/v1/users/profile").expect(401);
    });
  });

  describe("PATCH /api/v1/users/profile", () => {
    it("should update profile fields", async () => {
      const updates = {
        firstName: "Updated",
        lastName: "Name",
      };

      const response = await request(app)
        .patch("/api/v1/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject(updates);
    });

    it("should reject invalid email format", async () => {
      const response = await request(app)
        .patch("/api/v1/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "not-an-email" })
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });

    it("should reject name that is too long", async () => {
      const response = await request(app)
        .patch("/api/v1/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ firstName: "a".repeat(51) })
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("GET /api/v1/users/preferences", () => {
    it("should return user preferences", async () => {
      const response = await request(app)
        .get("/api/v1/users/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("userId", userId);
      expect(response.body).toHaveProperty("currency");
      expect(response.body).toHaveProperty("budgetPerWeekCents");
      expect(response.body).toHaveProperty("alertEnabled");
      expect(response.body).toHaveProperty("mealsPerDay");
      expect(response.body).toHaveProperty("dietaryRestrictions");
    });
  });

  describe("PATCH /api/v1/users/preferences", () => {
    it("should update preferences", async () => {
      const updates = {
        budgetPerWeekCents: 20000,
        mealsPerDay: 3,
        dietaryRestrictions: ["vegan", "gluten-free"],
        alertEnabled: true,
      };

      const response = await request(app)
        .patch("/api/v1/users/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject(updates);
    });

    it("should reject invalid budget", async () => {
      const response = await request(app)
        .patch("/api/v1/users/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ budgetPerWeekCents: -1000 })
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });

    it("should reject a budget above the Int4-safe ceiling with a clear message", async () => {
      const response = await request(app)
        .patch("/api/v1/users/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ budgetPerWeekCents: 99999999999 })
        .expect(400);

      expect(JSON.stringify(response.body)).toContain("between 0 and 2000000000");
    });

    it("should accept a budget at the ceiling", async () => {
      const response = await request(app)
        .patch("/api/v1/users/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ budgetPerWeekCents: 2000000000 })
        .expect(200);

      expect(response.body.budgetPerWeekCents).toBe(2000000000);
    });

    it("should reject invalid meals per day", async () => {
      const response = await request(app)
        .patch("/api/v1/users/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ mealsPerDay: 10 })
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("PATCH /api/v1/users/password", () => {
    it("should change password", async () => {
      const response = await request(app)
        .patch("/api/v1/users/password")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          currentPassword: "TestPass123",
          newPassword: "NewPass456",
        })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Password changed");
    });

    it("should login with new password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "NewPass456",
        })
        .expect(200);

      expect(response.body).toHaveProperty("token");

      // Update token for future tests
      authToken = response.body.token;
    });

    it("should reject wrong current password", async () => {
      const response = await request(app)
        .patch("/api/v1/users/password")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          currentPassword: "WrongPass123",
          newPassword: "AnotherPass789",
        })
        .expect(401);

      expect(response.body).toHaveProperty("message");
    });

    it("should reject weak new password", async () => {
      const response = await request(app)
        .patch("/api/v1/users/password")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          currentPassword: "NewPass456",
          newPassword: "weak",
        })
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("DELETE /api/v1/users/account", () => {
    it("should require password", async () => {
      const response = await request(app)
        .delete("/api/v1/users/account")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });

    it("should reject wrong password", async () => {
      const response = await request(app)
        .delete("/api/v1/users/account")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: "WrongPass123" })
        .expect(401);

      expect(response.body).toHaveProperty("message");
    });

    it("should deactivate account with correct password", async () => {
      const response = await request(app)
        .delete("/api/v1/users/account")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: "NewPass456" })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("deactivated");
    });

    it("should not allow login after deactivation", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "NewPass456",
        })
        .expect(403);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("deactivated");
    });
  });
});

describe("Users currency validation", () => {
  let token: string;

  beforeAll(async () => {
    const response = await request(app).post("/api/v1/auth/signup").send({
      email: "users-test-currency@example.com",
      password: "TestPass123",
      firstName: "Currency",
      lastName: "Test",
    });
    token = response.body.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: "users-test-currency" } },
    });
  });

  const patch = (body: Record<string, unknown>) =>
    request(app)
      .patch("/api/v1/users/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  it("rejects XXX", async () => {
    await patch({ currency: "XXX" }).expect(400);
  });

  it("rejects ZZZ", async () => {
    await patch({ currency: "ZZZ" }).expect(400);
  });

  it("rejects a non-string currency", async () => {
    await patch({ currency: 123 }).expect(400);
  });

  it("accepts lower-case jpy and stores JPY", async () => {
    const response = await patch({ currency: "jpy" }).expect(200);
    expect(response.body.currency).toBe("JPY");
  });

  it("accepts USD", async () => {
    const response = await patch({ currency: "USD" }).expect(200);
    expect(response.body.currency).toBe("USD");
  });

  it("exposes exactly 16 supported currencies, PHP first", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SUPPORTED_CURRENCIES } = require("../src/constants/currencies");
    expect(SUPPORTED_CURRENCIES).toHaveLength(16);
    expect(SUPPORTED_CURRENCIES[0]).toBe("PHP");
  });
});

describe("Users onboarding completion", () => {
  let token: string;

  beforeAll(async () => {
    const response = await request(app).post("/api/v1/auth/signup").send({
      email: "users-test-onboarding@example.com",
      password: "TestPass123",
      firstName: "Onboarding",
      lastName: "Test",
    });
    token = response.body.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: "users-test-onboarding" } },
    });
  });

  it("returns onboardingCompletedAt: null for a new user", async () => {
    const response = await request(app)
      .get("/api/v1/users/preferences")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body).toHaveProperty("onboardingCompletedAt", null);
  });

  it("cannot be set through PATCH /preferences", async () => {
    const response = await request(app)
      .patch("/api/v1/users/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ onboardingCompletedAt: "2000-01-01T00:00:00.000Z" })
      .expect(200);
    expect(response.body.onboardingCompletedAt).toBeNull();
  });

  it("requires authentication to complete onboarding", async () => {
    await request(app).post("/api/v1/users/onboarding/complete").expect(401);
  });

  it("stamps server time once and is idempotent", async () => {
    const first = await request(app)
      .post("/api/v1/users/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(typeof first.body.onboardingCompletedAt).toBe("string");
    expect(Number.isNaN(Date.parse(first.body.onboardingCompletedAt))).toBe(false);

    const second = await request(app)
      .post("/api/v1/users/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(second.body.onboardingCompletedAt).toBe(first.body.onboardingCompletedAt);
  });
});
