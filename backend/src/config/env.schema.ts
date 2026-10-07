/**
 * Environment schema (pure).
 *
 * No access to process.env here: callers pass the raw values in, which keeps
 * the schema trivially testable. Error messages contain paths and rules only,
 * never the supplied values.
 */

import { z } from "zod";

const WEAK_SECRET_FRAGMENTS: readonly string[] = [
  "your-super-secret-jwt-key-change-this-in-production",
  "change-this",
  "secret",
  "jwt-secret",
  "default",
];

const SLUG = /^[a-z0-9-]+$/;

const normalizeEntry = (value: string): string =>
  value.trim().replace(/\/+$/, "");

const parseOriginList = (value: string): string[] =>
  value
    .split(",")
    .map(normalizeEntry)
    .filter((entry) => entry.length > 0);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).optional(),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, "must be a postgres:// or postgresql:// URL"),
    JWT_SECRET: z
      .string()
      .min(32, "must be at least 32 characters")
      .refine(
        (value) =>
          !WEAK_SECRET_FRAGMENTS.some((weak) => value.toLowerCase().includes(weak)),
        "looks like a default/weak value"
      ),
    JWT_EXPIRES_IN: z.string().min(1).default("7d"),
    API_VERSION: z.string().min(1).default("v1"),
    LOG_LEVEL: z.string().min(1).default("info"),
    CORS_ORIGIN: z.string().default("http://localhost:3000").transform(parseOriginList),
    FRONTEND_URL: z.url().optional(),
    VERCEL_PREVIEW_SCOPE: z
      .string()
      .regex(SLUG, "must match ^[a-z0-9-]+$")
      .optional(),
    VERCEL_PREVIEW_PROJECT: z
      .string()
      .regex(SLUG, "must match ^[a-z0-9-]+$")
      .default("kitcha"),
    GEMINI_AI_API_KEY: z.string().optional(),
    SPOONACULAR_API_KEY: z.string().optional(),
    ZAPIER_WEBHOOK_URL: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    if (env.PORT === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["PORT"],
        message: "is required in production (provided by the platform)",
      });
    }
    const unsafe = env.CORS_ORIGIN.some(
      (origin) => origin === "*" || origin.includes("localhost")
    );
    if (unsafe) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message: "must not contain '*' or localhost in production",
      });
    }
  });

export type ParsedEnv = z.output<typeof envSchema>;

/**
 * Validate raw env values. Throws a readable error (paths only) on failure.
 * FRONTEND_URL is merged into CORS_ORIGIN (normalized, deduplicated).
 */
export function parseEnv(raw: Record<string, string | undefined>): ParsedEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      "Invalid environment configuration:\n" + z.prettifyError(result.error)
    );
  }
  const data = result.data;
  const merged = data.FRONTEND_URL
    ? [...data.CORS_ORIGIN, normalizeEntry(data.FRONTEND_URL)]
    : data.CORS_ORIGIN;
  return { ...data, CORS_ORIGIN: Array.from(new Set(merged)) };
}
