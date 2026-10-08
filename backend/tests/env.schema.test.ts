import crypto from "crypto";
import { parseEnv } from "../src/config/env.schema";

const secret = crypto.randomBytes(32).toString("hex");
const DB = "postgresql://user:pw-hidden@localhost:5432/db";

const base = (extra: Record<string, string | undefined> = {}) => ({
  DATABASE_URL: DB,
  JWT_SECRET: secret,
  ...extra,
});

const prod = (extra: Record<string, string | undefined> = {}) =>
  base({
    NODE_ENV: "production",
    PORT: "8080",
    CORS_ORIGIN: "https://kitcha-ai.vercel.app",
    ...extra,
  });

describe("parseEnv", () => {
  it("applies defaults for a valid dev env", () => {
    const env = parseEnv(base());
    expect(env.NODE_ENV).toBe("development");
    expect(env.JWT_EXPIRES_IN).toBe("7d");
    expect(env.API_VERSION).toBe("v1");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.CORS_ORIGIN).toEqual(["http://localhost:3000"]);
    expect(env.VERCEL_PREVIEW_PROJECT).toBe("kitcha");
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => parseEnv({ JWT_SECRET: secret })).toThrow(
      /^Invalid environment configuration/
    );
    expect(() => parseEnv({ JWT_SECRET: secret })).toThrow(/DATABASE_URL/);
  });

  it("rejects non-postgres DATABASE_URL", () => {
    expect(() => parseEnv(base({ DATABASE_URL: "mysql://u:p@h/db" }))).toThrow();
  });

  it("rejects short JWT_SECRET", () => {
    expect(() => parseEnv(base({ JWT_SECRET: "short" }))).toThrow();
  });

  it("rejects weak JWT_SECRET", () => {
    const weak = "my-secret-" + "x".repeat(30);
    expect(weak.length).toBe(40);
    expect(() => parseEnv(base({ JWT_SECRET: weak }))).toThrow(
      /default\/weak/
    );
  });

  it("never leaks secret or database URL in the message", () => {
    let message = "";
    try {
      parseEnv({ DATABASE_URL: "mysql://user:pw-hidden@h/db", JWT_SECRET: "tiny-abc" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain("pw-hidden");
    expect(message).not.toContain("tiny-abc");
  });

  it("normalizes CORS_ORIGIN into a trimmed list", () => {
    const env = parseEnv(
      base({ CORS_ORIGIN: "https://a.example/, https://b.example, ," })
    );
    expect(env.CORS_ORIGIN).toEqual(["https://a.example", "https://b.example"]);
  });

  it("merges FRONTEND_URL once, deduplicated", () => {
    const env = parseEnv(
      base({
        CORS_ORIGIN: "https://kitcha-ai.vercel.app",
        FRONTEND_URL: "https://kitcha-ai.vercel.app/",
      })
    );
    expect(env.CORS_ORIGIN).toEqual(["https://kitcha-ai.vercel.app"]);
  });

  it("requires PORT in production and coerces it", () => {
    expect(() => parseEnv(prod({ PORT: undefined }))).toThrow(/PORT/);
    expect(parseEnv(prod()).PORT).toBe(8080);
  });

  it("rejects wildcard or localhost CORS in production", () => {
    expect(() => parseEnv(prod({ CORS_ORIGIN: "*" }))).toThrow();
    expect(() =>
      parseEnv(prod({ CORS_ORIGIN: "http://localhost:3000" }))
    ).toThrow();
  });

  it.each([
    ["FRONTEND_URL", "http://localhost:3000"],
    ["FRONTEND_URL", "http://kitcha-ai.vercel.app"],
    ["FRONTEND_URL", "https://127.0.0.1:3000"],
    ["FRONTEND_URL", "https://0.0.0.0"],
    ["CORS_ORIGIN", "https://localhost"],
    ["CORS_ORIGIN", "https://[::1]:3000"],
    ["CORS_ORIGIN", "http://kitcha-ai.vercel.app"],
    ["CORS_ORIGIN", "https://a.example,*"],
  ])("rejects %s=%s in production", (key, value) => {
    expect(() => parseEnv(prod({ [key]: value }))).toThrow(new RegExp(key));
  });

  it.each(["kitcha-ai.vercel.app", "https://a.example/app", "ftp://a.example", "https://a.example?x=1"])(
    "rejects non-origin value %s",
    (value) => {
      expect(() => parseEnv(prod({ CORS_ORIGIN: value }))).toThrow(/bare origin/);
      expect(() => parseEnv(prod({ FRONTEND_URL: value }))).toThrow(/FRONTEND_URL/);
    }
  );

  it("accepts a valid https FRONTEND_URL in production", () => {
    const env = parseEnv(prod({ FRONTEND_URL: "https://kitcha-ai.vercel.app/" }));
    expect(env.CORS_ORIGIN).toEqual(["https://kitcha-ai.vercel.app"]);
  });

  it("validates VERCEL_PREVIEW_SCOPE", () => {
    expect(() => parseEnv(base({ VERCEL_PREVIEW_SCOPE: "Bad Scope!" }))).toThrow();
    expect(
      parseEnv(base({ VERCEL_PREVIEW_SCOPE: "ervenderrs-projects" }))
        .VERCEL_PREVIEW_SCOPE
    ).toBe("ervenderrs-projects");
  });
});

describe("parseEnv AI settings", () => {
  it("applies AI defaults", () => {
    const env = parseEnv(base());
    expect(env.AI_PROVIDER).toBe("dahl");
    expect(env.AI_BASE_URL).toBe("https://inference.dahl.global/v1");
    expect(env.AI_MODEL).toBe("MiniMaxAI/MiniMax-M2.7");
    expect(env.AI_TIMEOUT_MS).toBe(40000);
    expect(env.AI_MAX_TOKENS).toBe(8000);
    expect(env.AI_JSON_MODE).toBe("off");
    expect(env.AI_USER_DAILY_LIMIT).toBe(20);
    expect(env.AI_GLOBAL_DAILY_LIMIT).toBe(100);
    expect(env.OFF_CONTACT).toBe("https://github.com/ervenderr/Smart-Grocery-Meal-Planner");
    expect(env.AI_API_KEY).toBeUndefined();
  });

  it("bounds the AI daily limits", () => {
    expect(() => parseEnv(base({ AI_USER_DAILY_LIMIT: "1001" }))).toThrow();
    expect(() => parseEnv(base({ AI_GLOBAL_DAILY_LIMIT: "100001" }))).toThrow();
    expect(parseEnv(base({ AI_USER_DAILY_LIMIT: "1000" })).AI_USER_DAILY_LIMIT).toBe(1000);
  });

  it("treats blank AI_API_KEY and USDA_API_KEY as unset", () => {
    const env = parseEnv(base({ AI_API_KEY: "", USDA_API_KEY: "" }));
    expect(env.AI_API_KEY).toBeUndefined();
    expect(env.USDA_API_KEY).toBeUndefined();
  });

  it("strips trailing slashes from AI_BASE_URL", () => {
    expect(parseEnv(base({ AI_BASE_URL: "https://x.example/v1//" })).AI_BASE_URL).toBe(
      "https://x.example/v1"
    );
  });

  it("rejects an invalid AI_BASE_URL and http in production", () => {
    expect(() => parseEnv(base({ AI_BASE_URL: "not a url" }))).toThrow(/AI_BASE_URL/);
    expect(() => parseEnv(prod({ AI_BASE_URL: "http://x.example/v1" }))).toThrow(/AI_BASE_URL/);
    expect(parseEnv(prod({ AI_BASE_URL: "https://x.example/v1" })).AI_BASE_URL).toBe(
      "https://x.example/v1"
    );
  });

  it("never echoes the AI_API_KEY value in error output", () => {
    const key = "dummy-key-value-0123456789";
    let message = "";
    try {
      parseEnv(base({ AI_API_KEY: key, AI_JSON_MODE: "bogus" }));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/AI_JSON_MODE/);
    expect(message).not.toContain(key);
  });
});

describe("parseEnv legacy variables", () => {
  it("ignores a leftover GEMINI_AI_API_KEY instead of failing startup", () => {
    const env = parseEnv(base({ GEMINI_AI_API_KEY: "leftover-value" }));
    expect(env).not.toHaveProperty("GEMINI_AI_API_KEY");
  });
});
