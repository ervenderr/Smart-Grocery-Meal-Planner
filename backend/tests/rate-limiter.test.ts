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
  it("limits unauthenticated and bad-token shopping floods per IP, not authenticated users", async () => {
    // The general limit is 100 per IP (signup already used one); expect 401s, then 429.
    let unauthorized = 0;
    let limited = 0;
    for (let i = 0; i < 110; i += 1) {
      const res = await request(app)
        .get("/api/v1/shopping/list")
        .set("Authorization", i % 2 === 0 ? "Bearer garbage" : "");
      if (res.status === 401) unauthorized += 1;
      if (res.status === 429) limited += 1;
    }
    expect(unauthorized).toBeGreaterThanOrEqual(95);
    expect(unauthorized).toBeLessThanOrEqual(100);
    expect(limited).toBe(110 - unauthorized);

    // A valid user from the same IP keeps working past the general limit.
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .get("/api/v1/shopping/list")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  it("hasValidBearerToken rejects missing, malformed and forged tokens", () => {
    const { hasValidBearerToken } = limiterModule;
    const req = (authorization?: string) =>
      ({ headers: { authorization } }) as unknown as import("express").Request;
    expect(hasValidBearerToken(req())).toBe(false);
    expect(hasValidBearerToken(req("Bearer nope"))).toBe(false);
    expect(hasValidBearerToken(req(`Bearer ${token}`))).toBe(true);
    expect(hasValidBearerToken(req(`Bearer ${token}x`))).toBe(false);
  });
});

describe("per-user pantry/sync limiters", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const limiter = require("../src/middleware/rateLimiter") as typeof import("../src/middleware/rateLimiter");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require("express") as typeof import("express");

  it.each([
    "/api/v1/pantry/abc",
    "/api/v1/pantry",
    "/api/v1/sync/bootstrap?cursor=x",
    "/api/v1/shopping/list",
  ])("isUserScopedApiRequest matches %s", (url) => {
    expect(limiter.isUserScopedApiRequest(url)).toBe(true);
  });

  it.each(["/api/v1/pantryx", "/api/v1/recipes", "/api/v1/auth/login"])(
    "isUserScopedApiRequest rejects %s",
    (url) => {
      expect(limiter.isUserScopedApiRequest(url)).toBe(false);
    }
  );

  const buildApp = (mount: import("express").RequestHandler) => {
    const app = express();
    app.use((req, _res, next) => {
      const id = req.header("x-test-user");
      if (id) (req as unknown as { user: { id: string } }).user = { id };
      next();
    });
    app.use(mount);
    app.get("/x", (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  };

  it("429s the third request per user with the configured code, other users unaffected", async () => {
    const app = buildApp(
      limiter.createUserScopedLimiter({ limit: 2, code: "TEST_LIMITED", message: "slow down" })
    );
    const hit = (u: string) => request(app).get("/x").set("x-test-user", u);
    expect((await hit("u1")).status).toBe(200);
    expect((await hit("u1")).status).toBe(200);
    const blocked = await hit("u1");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("TEST_LIMITED");
    expect((await hit("u2")).status).toBe(200);
  });

  it("pantry limiter answers 429 PANTRY_RATE_LIMITED", async () => {
    const app = buildApp(limiter.createPantryLimiter(1));
    await request(app).get("/x").set("x-test-user", "p1");
    const res = await request(app).get("/x").set("x-test-user", "p1");
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("PANTRY_RATE_LIMITED");
  });

  it("sync limiter answers 429 SYNC_RATE_LIMITED", async () => {
    const app = buildApp(limiter.createSyncLimiter(1));
    await request(app).get("/x").set("x-test-user", "s1");
    const res = await request(app).get("/x").set("x-test-user", "s1");
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("SYNC_RATE_LIMITED");
  });

  it("refreshLimiter and default limiters are exported", () => {
    expect(limiter.refreshLimiter).toBeDefined();
    expect(limiter.pantryLimiter).toBeDefined();
    expect(limiter.syncLimiter).toBeDefined();
  });

  it("refreshLimiter 429s with AUTH_REFRESH_RATE_LIMITED only after 30 failures", async () => {
    const app = express();
    app.use(limiter.refreshLimiter);
    app.get("/x", (_req, res) => {
      res.status(401).json({});
    });
    let last = 0;
    let body: { code?: string } = {};
    for (let i = 0; i < 31; i += 1) {
      const res = await request(app).get("/x");
      last = res.status;
      body = res.body;
    }
    expect(last).toBe(429);
    expect(body.code).toBe("AUTH_REFRESH_RATE_LIMITED");
  });
});
