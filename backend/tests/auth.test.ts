/**
 * Authentication Tests
 *
 * Tests for auth endpoints (signup, login, protected routes).
 *
 * WHAT WE'RE TESTING:
 * - User can signup
 * - Duplicate email rejected
 * - Weak password rejected
 * - User can login
 * - Wrong password rejected
 * - Protected routes require token
 * - Protected routes work with valid token
 */

import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/database.config";

const app = createApp();

describe("Authentication Endpoints", () => {
  // Test user data
  const testUser = {
    email: "auth-test@example.com",
    password: "TestPass123",
    firstName: "Auth",
    lastName: "Test",
  };

  let authToken: string;

  // Clean up test user after all tests
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: "auth-test" } },
    });
  });

  describe("POST /api/v1/auth/signup", () => {
    it("should create a new user and return token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("expiresIn", "7d");

      expect(response.body.user).toMatchObject({
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      });

      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("createdAt");

      // Save token for other tests
      authToken = response.body.token;
    });

    it("should reject duplicate email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser)
        .expect(409);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("already exists");
    });

    it("should reject weak password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          email: "weak@example.com",
          password: "weak", // Too short, no uppercase, no number
          firstName: "Test",
        })
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });

    it("should reject invalid email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          email: "not-an-email",
          password: "TestPass123",
        })
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login with correct credentials", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should reject wrong password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123",
        })
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Invalid");
    });

    it("should reject non-existent user", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "TestPass123",
        })
        .expect(401);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should return user profile with valid token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("email", testUser.email);
      expect(response.body).toHaveProperty("firstName");
      expect(response.body).toHaveProperty("isActive", true);
    });

    it("should reject request without token", async () => {
      const response = await request(app).get("/api/v1/auth/me").expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("token");
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid-token-here")
        .expect(401);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should return success message", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Logout successful");
    });
  });
});
