/**
 * Express Application Setup
 *
 * This file configures the Express app with all middleware and routes.
 * Keeping this separate from index.ts makes testing easier.
 *
 * MIDDLEWARE ORDER MATTERS:
 * 1. trust proxy (Railway edge), then /health (DB-free, never redirected)
 * 2. HTTPS redirect (production), helmet
 * 3. Origin guard (403) and CORS
 * 4. Rate limiting, body parsing, logging
 * 5. Routes
 * 6. Error handling (must be last)
 */

import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/env.config";
import { morganStream } from "./config/logger.config";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";
import {
  buildCorsOptions,
  buildOriginPredicate,
  originGuard,
} from "./config/cors.config";

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  console.log("🏗️  Creating Express application...");
  const app: Application = express();

  /**
   * Trust exactly two proxy hops (Railway edge + its internal proxy).
   * Railway overwrites X-Forwarded-For with "<real client>, <edge ip>" (the
   * edge IP varies per request), so with 2 hops req.ip is the real client and
   * client-supplied values are stripped upstream. Never `true`.
   * Verified against the live deployment in plan 01-05.
   */
  app.set("trust proxy", 2);

  /**
   * Health check: registered before the HTTPS redirect and origin guard so
   * Railway's plain-HTTP probe always gets 200. No DB access, no env details.
   */
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ===== SECURITY MIDDLEWARE =====
  console.log("🔒 Setting up security middleware...");

  /**
   * HTTPS Enforcement in Production
   * Redirects HTTP to HTTPS
   */
  if (config.env === "production") {
    app.use((req, res, next) => {
      if (req.secure) {
        next();
      } else {
        res.redirect(301, `https://${req.header("host")}${req.originalUrl}`);
      }
    });
  }

  /**
   * Helmet: Sets various HTTP headers for security
   * - Prevents clickjacking, XSS attacks, etc.
   * - Enhanced configuration with strict security policies
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: "same-origin" },
      noSniff: true,
      xssFilter: true,
    })
  );

  const isAllowed = buildOriginPredicate({
    origins: config.cors.origin,
    previewProject: config.cors.previewProject,
    previewScope: config.cors.previewScope,
  });
  app.use(originGuard(isAllowed));
  app.use(cors(buildCorsOptions(isAllowed)));

  // ===== RATE LIMITING =====
  /**
   * Apply rate limiting to all API routes
   * Prevents brute force attacks and API abuse
   */
  console.log("🚦 Setting up rate limiting...");
  app.use("/api/", apiLimiter);

  // ===== BODY PARSING =====
  /**
   * Parse JSON request bodies
   * Reduced limit from 10mb to 1mb to prevent DOS attacks
   */
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // ===== LOGGING =====
  /**
   * Morgan: HTTP request logger
   * Logs all incoming requests with details
   */
  if (config.env === "development") {
    app.use(morgan("dev", { stream: morganStream }));
  } else {
    app.use(morgan("combined", { stream: morganStream }));
  }

  // ===== API ROUTES =====
  /**
   * Base route - API information
   */
  app.get(`/api/${config.apiVersion}`, (_req: Request, res: Response) => {
    res.json({
      message: "Kitcha API",
      version: config.apiVersion,
      documentation: `/api/${config.apiVersion}/docs`,
      endpoints: {
        auth: `/api/${config.apiVersion}/auth`,
        health: "/health",
      },
    });
  });

  // Import and register route modules
  console.log("📦 Loading route modules...");

  console.log("  - Loading auth routes...");
  const authRoutes = require("./modules/auth/auth.routes").default;

  console.log("  - Loading users routes...");
  const usersRoutes = require("./modules/users/users.routes").default;

  console.log("  - Loading pantry routes...");
  const pantryRoutes = require("./modules/pantry/pantry.routes").default;

  console.log("  - Loading recipe routes...");
  const recipeRoutes = require("./modules/recipe/recipe.routes").default;

  console.log("  - Loading mealplan routes...");
  const mealPlanRoutes = require("./modules/mealplan/mealplan.routes").default;

  console.log("  - Loading marketprice routes...");
  const priceRoutes =
    require("./modules/marketprice/marketprice.routes").default;

  console.log("  - Loading alert routes...");
  const alertRoutes = require("./modules/alert/alert.routes").default;

  console.log("  - Loading analytics routes...");
  const analyticsRoutes =
    require("./modules/analytics/analytics.routes").default;

  console.log("  - Loading AI routes...");
  const aiRoutes = require("./modules/ai/ai.routes").default;

  console.log("  - Loading notification routes...");
  const notificationRoutes =
    require("./modules/notification/notification.routes").default;

  console.log("  - Loading zapier routes...");
  const zapierRoutes = require("./modules/zapier/zapier.routes").default;

  console.log("✅ All route modules loaded successfully");

  app.use(`/api/${config.apiVersion}/auth`, authRoutes);
  app.use(`/api/${config.apiVersion}/users`, usersRoutes);
  app.use(`/api/${config.apiVersion}/pantry`, pantryRoutes);
  app.use(`/api/${config.apiVersion}/recipes`, recipeRoutes);
  app.use(`/api/${config.apiVersion}/mealplans`, mealPlanRoutes);
  app.use(`/api/${config.apiVersion}/prices`, priceRoutes);
  app.use(`/api/${config.apiVersion}/alerts`, alertRoutes);
  app.use(`/api/${config.apiVersion}/analytics`, analyticsRoutes);
  app.use(`/api/${config.apiVersion}/ai`, aiRoutes);
  app.use(`/api/${config.apiVersion}/notifications`, notificationRoutes);
  app.use(`/api/${config.apiVersion}/zapier`, zapierRoutes);

  console.log("✅ All routes registered successfully");

  // ===== ERROR HANDLING =====
  /**
   * 404 handler - must come after all routes
   */
  app.use(notFoundHandler);

  /**
   * Global error handler - must be last middleware
   */
  app.use(errorHandler);

  console.log("✅ Express app created successfully");
  return app;
}
