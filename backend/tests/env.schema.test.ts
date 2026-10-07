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

  it("validates VERCEL_PREVIEW_SCOPE", () => {
    expect(() => parseEnv(base({ VERCEL_PREVIEW_SCOPE: "Bad Scope!" }))).toThrow();
    expect(
      parseEnv(base({ VERCEL_PREVIEW_SCOPE: "ervenderrs-projects" }))
        .VERCEL_PREVIEW_SCOPE
    ).toBe("ervenderrs-projects");
  });
});
