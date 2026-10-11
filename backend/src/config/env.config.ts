/**
 * Environment Configuration
 *
 * This file centralizes all environment variables and provides
 * type-safe access throughout the application.
 *
 * WHY: Centralizing config prevents typos, provides validation,
 * and makes it easy to see all required environment variables.
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { parseEnv, ParsedEnv } from "./env.schema";

// Load environment variables from .env file (development only)
// In production (Railway, etc.), environment variables are provided by the platform
const envPath = path.join(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // In production, just load from process.env
  dotenv.config();
}

let parsed: ParsedEnv;
try {
  parsed = parseEnv(process.env);
} catch (error) {
  console.error((error as Error).message);
  throw error;
}

/**
 * Export strongly-typed configuration object
 * All environment variables accessed through this object
 */
export const config = Object.freeze({
  // Server
  env: parsed.NODE_ENV as string,
  port: parsed.PORT ?? 3001,
  apiVersion: parsed.API_VERSION,
  publicHost: parsed.PUBLIC_HOST ?? parsed.RAILWAY_PUBLIC_DOMAIN,

  // Database
  database: Object.freeze({ url: parsed.DATABASE_URL }),

  // JWT
  jwt: Object.freeze({
    secret: parsed.JWT_SECRET,
    expiresIn: parsed.JWT_EXPIRES_IN,
  }),

  // Refresh tokens (SYNC-04)
  refreshToken: Object.freeze({
    ttlDays: parsed.REFRESH_TOKEN_TTL_DAYS,
    reuseGraceSeconds: parsed.REFRESH_REUSE_GRACE_SECONDS,
  }),

  // Idempotency keys (SYNC-01)
  idempotency: Object.freeze({ ttlHours: parsed.IDEMPOTENCY_TTL_HOURS }),

  // CORS
  cors: Object.freeze({
    origin: Object.freeze([...parsed.CORS_ORIGIN]) as readonly string[] as string[],
    previewProject: parsed.VERCEL_PREVIEW_PROJECT,
    previewScope: parsed.VERCEL_PREVIEW_SCOPE,
  }),

  // Logging
  logging: Object.freeze({ level: parsed.LOG_LEVEL }),

  // Optional APIs
  apis: Object.freeze({
    spoonacular: parsed.SPOONACULAR_API_KEY,
  }),

  // AI provider (single OpenAI-compatible endpoint, env-configured)
  ai: Object.freeze({
    provider: parsed.AI_PROVIDER,
    baseUrl: parsed.AI_BASE_URL,
    model: parsed.AI_MODEL,
    apiKey: parsed.AI_API_KEY,
    timeoutMs: parsed.AI_TIMEOUT_MS,
    maxTokens: parsed.AI_MAX_TOKENS,
    jsonMode: parsed.AI_JSON_MODE,
    userDailyLimit: parsed.AI_USER_DAILY_LIMIT,
    globalDailyLimit: parsed.AI_GLOBAL_DAILY_LIMIT,
    paidUserDailyLimit: parsed.AI_PAID_USER_DAILY_LIMIT,
    freeMonthlyLimit: parsed.AI_FREE_MONTHLY_LIMIT,
    paidMonthlyLimit: parsed.AI_PAID_MONTHLY_LIMIT,
  }),

  // One-time unlock (StoreKit 2 verification)
  iap: Object.freeze({
    bundleId: parsed.APPLE_BUNDLE_ID,
    appAppleId: parsed.APPLE_APP_APPLE_ID,
    productId: parsed.IAP_PRODUCT_ID,
    onlineChecks:
      parsed.IAP_ONLINE_CHECKS !== undefined
        ? parsed.IAP_ONLINE_CHECKS === "true"
        : parsed.NODE_ENV === "production",
    allowXcodeEnv: parsed.IAP_ALLOW_XCODE_ENV === "true",
  }),

  // Free-tier limits
  entitlements: Object.freeze({ freePantryLimit: parsed.FREE_PANTRY_LIMIT }),

  // Food data lookups (Open Food Facts / USDA)
  foodData: Object.freeze({
    usdaApiKey: parsed.USDA_API_KEY,
    offContact: parsed.OFF_CONTACT,
  }),

  // Zapier Integration
  zapier: Object.freeze({ webhookUrl: parsed.ZAPIER_WEBHOOK_URL }),
}) as {
  readonly env: string;
  readonly port: number;
  readonly apiVersion: string;
  readonly publicHost?: string;
  readonly database: { readonly url: string };
  readonly jwt: { readonly secret: string; readonly expiresIn: string };
  readonly refreshToken: { readonly ttlDays: number; readonly reuseGraceSeconds: number };
  readonly idempotency: { readonly ttlHours: number };
  readonly cors: {
    readonly origin: string[];
    readonly previewProject: string;
    readonly previewScope?: string;
  };
  readonly logging: { readonly level: string };
  readonly apis: { readonly spoonacular?: string };
  readonly ai: {
    readonly provider: string;
    readonly baseUrl: string;
    readonly model: string;
    readonly apiKey?: string;
    readonly timeoutMs: number;
    readonly maxTokens: number;
    readonly jsonMode: "off" | "json_object";
    readonly userDailyLimit: number;
    readonly globalDailyLimit: number;
    readonly paidUserDailyLimit: number;
    readonly freeMonthlyLimit: number;
    readonly paidMonthlyLimit: number;
  };
  readonly iap: {
    readonly bundleId: string;
    readonly appAppleId: number | undefined;
    readonly productId: string;
    readonly onlineChecks: boolean;
    readonly allowXcodeEnv: boolean;
  };
  readonly entitlements: { readonly freePantryLimit: number };
  readonly foodData: { readonly usdaApiKey?: string; readonly offContact: string };
  readonly zapier: { readonly webhookUrl?: string };
};

// Export helper to check if we're in production
export const isProduction = config.env === "production";
export const isDevelopment = config.env === "development";
