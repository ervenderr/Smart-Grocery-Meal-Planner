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

/** Blank values (e.g. an empty Railway variable) count as unset. */
const blankToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalSecret = z.preprocess(blankToUndefined, z.string().min(1).optional());

const normalizeEntry = (value: string): string =>
  value.trim().replace(/\/+$/, "");

const parseOriginList = (value: string): string[] =>
  value
    .split(",")
    .map(normalizeEntry)
    .filter((entry) => entry.length > 0);

function parseOrigin(value: string): URL | undefined {
  try {
    const url = new URL(value);
    const isWeb = url.protocol === "http:" || url.protocol === "https:";
    return isWeb && url.origin === value ? url : undefined;
  } catch {
    return undefined;
  }
}

const isLoopbackHost = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname === "0.0.0.0" ||
  hostname === "[::1]" ||
  hostname === "[::]" ||
  /^127\./.test(hostname);

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
    FRONTEND_URL: z.string().transform(normalizeEntry).optional(),
    PUBLIC_HOST: z
      .string()
      .regex(/^[a-z0-9.-]+(:[0-9]{1,5})?$/i, "must be a bare host[:port]")
      .optional(),
    RAILWAY_PUBLIC_DOMAIN: z
      .string()
      .regex(/^[a-z0-9.-]+$/i, "must be a bare hostname")
      .optional(),
    VERCEL_PREVIEW_SCOPE: z
      .string()
      .regex(SLUG, "must match ^[a-z0-9-]+$")
      .optional(),
    VERCEL_PREVIEW_PROJECT: z
      .string()
      .regex(SLUG, "must match ^[a-z0-9-]+$")
      .default("kitcha"),
    AI_PROVIDER: z.string().min(1).default("dahl"),
    AI_BASE_URL: z
      .url()
      .default("https://inference.dahl.global/v1")
      .transform((value) => value.replace(/\/+$/, "")),
    AI_MODEL: z.string().min(1).default("MiniMaxAI/MiniMax-M2.7"),
    AI_API_KEY: optionalSecret,
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(110000).default(40000),
    AI_MAX_TOKENS: z.coerce.number().int().min(256).max(32000).default(8000),
    AI_JSON_MODE: z.enum(["off", "json_object"]).default("off"),
    AI_USER_DAILY_LIMIT: z.coerce.number().int().min(1).default(20),
    AI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().min(1).default(100),
    USDA_API_KEY: optionalSecret,
    OFF_CONTACT: z
      .string()
      .min(3)
      .default("https://github.com/ervenderr/Smart-Grocery-Meal-Planner"),
    SPOONACULAR_API_KEY: z.string().optional(),
    ZAPIER_WEBHOOK_URL: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    const formatMessage = "must be a bare origin (scheme://host[:port], no path)";
    env.CORS_ORIGIN.forEach((origin, index) => {
      if (parseOrigin(origin) === undefined) {
        ctx.addIssue({ code: "custom", path: ["CORS_ORIGIN", index], message: formatMessage });
      }
    });
    if (env.FRONTEND_URL !== undefined && parseOrigin(env.FRONTEND_URL) === undefined) {
      ctx.addIssue({ code: "custom", path: ["FRONTEND_URL"], message: formatMessage });
    }

    if (env.NODE_ENV !== "production") return;

    if (env.PORT === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["PORT"],
        message: "is required in production (provided by the platform)",
      });
    }
    if (!env.AI_BASE_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_BASE_URL"],
        message: "must be an https URL in production",
      });
    }
    const entries: ReadonlyArray<readonly [string, string]> = [
      ...env.CORS_ORIGIN.map((origin) => ["CORS_ORIGIN", origin] as const),
      ...(env.FRONTEND_URL ? [["FRONTEND_URL", env.FRONTEND_URL] as const] : []),
    ];
    for (const [key, origin] of entries) {
      const url = parseOrigin(origin);
      if (url === undefined) continue; // reported by the origin-format check
      if (url.protocol !== "https:" || isLoopbackHost(url.hostname)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "must be an https origin and not loopback/localhost in production",
        });
      }
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
