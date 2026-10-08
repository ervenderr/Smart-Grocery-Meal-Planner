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
