import request from "supertest";
import type { Express } from "express";

const AI_STATUS = "/api/v1/ai/status";
const BURST_LIMIT = 10;

const stringify = (arg: unknown): string => {
  if (arg instanceof Error) {
    return `${arg.name} ${arg.message} ${(arg as { code?: string }).code ?? ""}`;
  }
  return typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg);
};

const signup = async (app: Express, email: string): Promise<string> => {
  const res = await request(app)
    .post("/api/v1/auth/signup")
    .send({ email, password: "TestPass123", firstName: "Rate", lastName: "Limit" });
  return res.body.token as string;
};

describe("AI burst limiter", () => {
  let app: Express;
  // Manual capture: jest config has restoreMocks, which would undo jest.spyOn per test
  const logged: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  let tokenA: string;
  let tokenB: string;
  const suffix = Date.now();

  beforeAll(async () => {
    const capture = (...args: unknown[]): void => {
      logged.push(args.map(stringify).join(" "));
    };
    console.error = capture;
    console.warn = capture;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      app = require("../src/app").createApp();
    });
    tokenA = await signup(app, `rl-a-${suffix}@example.com`);
    tokenB = await signup(app, `rl-b-${suffix}@example.com`);
  });

  afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });

  const get = (token: string) =>
    request(app).get(AI_STATUS).set("Authorization", `Bearer ${token}`);

  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(app).get(AI_STATUS);
    expect(res.status).toBe(401);
  });

  it("allows 10 requests per minute, then 429 with the shared error contract", async () => {
    for (let i = 0; i < BURST_LIMIT; i += 1) {
      const res = await get(tokenA);
      expect(res.status).toBe(200);
    }
    const limited = await get(tokenA);
    expect(limited.status).toBe(429);
    expect(limited.body.status).toBe("error");
    expect(limited.body.statusCode).toBe(429);
    expect(limited.body.code).toBe("AI_RATE_LIMITED");
    expect(typeof limited.body.message).toBe("string");
    expect(limited.body.error).toBe(limited.body.message);
  });

  it("keys by user id, so another user on the same IP is unaffected", async () => {
    const res = await get(tokenB);
    expect(res.status).toBe(200);
  });

  it("does not log ERR_ERL_KEY_GEN_IPV6", () => {
    expect(logged.join("\n")).not.toContain("ERR_ERL_KEY_GEN_IPV6");
  });
});

describe("Shopping limiter", () => {
  const suffix = `${Date.now()}`;
  const email = `rl-shop-${suffix}@example.com`;
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
    token = await signup(app, email);
  });

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prisma } = require("../src/config/database.config");
    const users = await prisma.user.findMany({
      where: { email: { startsWith: "rl-shop-" } },
      select: { id: true },
    });
    const ids = users.map((u: { id: string }) => u.id);
    await prisma.shoppingList.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("isShoppingRequest matches only the shopping prefix", () => {
    const { isShoppingRequest } = limiterModule;
    expect(isShoppingRequest("/api/v1/shopping/list")).toBe(true);
    expect(isShoppingRequest("/api/v1/shopping")).toBe(true);
    expect(isShoppingRequest("/api/v1/shopping?x=1")).toBe(true);
    expect(isShoppingRequest("/api/v1/shoppingx")).toBe(false);
    expect(isShoppingRequest("/api/v1/pantry")).toBe(false);
  });

  it("limits per user id with SHOPPING_RATE_LIMITED and spares other users", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const express = require("express") as typeof import("express");
    const mini = express();
    mini.use((req, _res, next) => {
      (req as unknown as { user: { id: string } }).user = {
        id: String(req.headers["x-user"]),
      };
      next();
    });
    mini.use(limiterModule.createShoppingLimiter(3));
    mini.get("/ping", (_req, res) => {
      res.json({ ok: true });
    });
    for (let i = 0; i < 3; i += 1) {
      await request(mini).get("/ping").set("x-user", "u1").expect(200);
    }
    const limited = await request(mini).get("/ping").set("x-user", "u1");
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("SHOPPING_RATE_LIMITED");
    expect(limited.body.error).toBe(limited.body.message);
    await request(mini).get("/ping").set("x-user", "u2").expect(200);
  });

  it("does not throttle 105 sequential shopping requests with the global limiter", async () => {
    for (let i = 0; i < 105; i += 1) {
      const res = await request(app)
        .get("/api/v1/shopping/list")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });
});
