import crypto from "crypto";
import request from "supertest";
import type { Application } from "express";

describe("production /health and HTTPS redirect", () => {
  const originalEnv = process.env;
  let app: Application;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      PORT: "8080",
      PUBLIC_HOST: "api.kitcha.example",
      CORS_ORIGIN: "https://kitcha-ai.vercel.app",
      DATABASE_URL: "postgresql://u:p@127.0.0.1:1/none",
      JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    };
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createApp } = require("../src/app");
    app = createApp();
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it("serves /health over plain HTTP without DB or redirect", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).not.toHaveProperty("environment");
  });

  it("serves /health even for a disallowed Origin", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(res.status).toBe(200);
  });

  it("redirects other plain HTTP requests with 308 to the configured host", async () => {
    const res = await request(app).get("/api/v1").set("Host", "evil.example");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe("https://api.kitcha.example/api/v1");
  });

  it("returns 403 JSON for a disallowed origin over HTTPS", async () => {
    const res = await request(app)
      .get("/api/v1")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body.statusCode).toBe(403);
  });
});
