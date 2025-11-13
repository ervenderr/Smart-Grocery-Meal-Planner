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
