import request from "supertest";
import type { Express } from "express";

const STATS = "/api/v1/notifications/stats";

describe("Notification stats limiter", () => {
  const suffix = `${Date.now()}`;
  let app: Express;
  let limiterModule: typeof import("../src/middleware/rateLimiter");
  let token: string;

  beforeAll(async () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      app = require("../src/app").createApp();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      limiterModule = require("../src/middleware/rateLimiter");
    });
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: `rl-notif-${suffix}@example.com`,
        password: "TestPass123",
        firstName: "Rate",
        lastName: "Notif",
      });
    token = res.body.token as string;
  });

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prisma } = require("../src/config/database.config");
    await prisma.user.deleteMany({ where: { email: { startsWith: "rl-notif-" } } });
  });

  it("isNotificationStatsRequest matches only GET on the stats path", () => {
    const { isNotificationStatsRequest } = limiterModule;
    expect(isNotificationStatsRequest("GET", STATS)).toBe(true);
    expect(isNotificationStatsRequest("GET", `${STATS}/`)).toBe(true);
    expect(isNotificationStatsRequest("GET", `${STATS}?x=1`)).toBe(true);
    expect(isNotificationStatsRequest("POST", STATS)).toBe(false);
    expect(isNotificationStatsRequest("GET", `${STATS}x`)).toBe(false);
    expect(isNotificationStatsRequest("GET", "/api/v1/notifications")).toBe(false);
    expect(isNotificationStatsRequest("GET", "/api/v1/notifications/stats/other")).toBe(false);
  });

  it("does not throttle 105 authenticated stats polls with the global limiter", async () => {
    for (let i = 0; i < 105; i += 1) {
      const res = await request(app).get(STATS).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  it("still throttles unauthenticated stats requests per IP", async () => {
    let limited = 0;
    for (let i = 0; i < 110; i += 1) {
      const res = await request(app).get(STATS);
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });

  it("per-user limiter returns NOTIFICATION_RATE_LIMITED and spares other users", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const express = require("express") as typeof import("express");
    const mini = express();
    mini.use((req, _res, next) => {
      (req as unknown as { user: { id: string } }).user = { id: String(req.headers["x-user"]) };
      next();
    });
    mini.use(limiterModule.createNotificationStatsLimiter(2));
    mini.get("/ping", (_req, res) => {
      res.json({ ok: true });
    });
    await request(mini).get("/ping").set("x-user", "u1").expect(200);
    await request(mini).get("/ping").set("x-user", "u1").expect(200);
    const limited = await request(mini).get("/ping").set("x-user", "u1");
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("NOTIFICATION_RATE_LIMITED");
    expect(limited.body.error).toBe(limited.body.message);
    await request(mini).get("/ping").set("x-user", "u2").expect(200);
  });
});
