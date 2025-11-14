/**
 * Express Application Setup
 *
 * This file configures the Express app with all middleware and routes.
 * Keeping this separate from index.ts makes testing easier.
 *
 * MIDDLEWARE ORDER MATTERS:
 * 1. Security (helmet, cors)
 * 2. Body parsing (express.json)
 * 3. Logging (morgan)
 * 4. Routes
 * 5. Error handling (must be last)
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.config';
import { morganStream } from './config/logger.config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app: Application = express();

  // ===== SECURITY MIDDLEWARE =====
  /**
   * Helmet: Sets various HTTP headers for security
   * - Prevents clickjacking, XSS attacks, etc.
   */
  app.use(helmet());

  /**
   * CORS: Allow requests from frontend
   * In production, this should be restricted to your frontend domain
   */
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true, // Allow cookies
    })
  );

  // ===== BODY PARSING =====
  /**
   * Parse JSON request bodies
   * Limit size to prevent DOS attacks
   */
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ===== LOGGING =====
  /**
   * Morgan: HTTP request logger
   * Logs all incoming requests with details
   */
  if (config.env === 'development') {
    app.use(morgan('dev', { stream: morganStream }));
  } else {
    app.use(morgan('combined', { stream: morganStream }));
  }

  // ===== HEALTH CHECK =====
  /**
   * Simple health check endpoint
   * Used by monitoring tools to check if server is alive
   */
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
    });
  });

  // ===== API ROUTES =====
  /**
   * Base route - API information
   */
  app.get(`/api/${config.apiVersion}`, (_req: Request, res: Response) => {
    res.json({
      message: 'Smart Grocery & Meal Planner API',
      version: config.apiVersion,
      documentation: `/api/${config.apiVersion}/docs`,
      endpoints: {
        auth: `/api/${config.apiVersion}/auth`,
        health: '/health',
      },
    });
  });

  // Import and register route modules
  const authRoutes = require('./modules/auth/auth.routes').default;
  const usersRoutes = require('./modules/users/users.routes').default;
  const pantryRoutes = require('./modules/pantry/pantry.routes').default;
  const recipeRoutes = require('./modules/recipe/recipe.routes').default;
  const mealPlanRoutes = require('./modules/mealplan/mealplan.routes').default;
  const priceRoutes = require('./modules/marketprice/marketprice.routes').default;
  const alertRoutes = require('./modules/alert/alert.routes').default;
  const analyticsRoutes = require('./modules/analytics/analytics.routes').default;
  const aiRoutes = require('./modules/ai/ai.routes').default;

  app.use(`/api/${config.apiVersion}/auth`, authRoutes);
  app.use(`/api/${config.apiVersion}/users`, usersRoutes);
  app.use(`/api/${config.apiVersion}/pantry`, pantryRoutes);
  app.use(`/api/${config.apiVersion}/recipes`, recipeRoutes);
  app.use(`/api/${config.apiVersion}/mealplans`, mealPlanRoutes);
  app.use(`/api/${config.apiVersion}/prices`, priceRoutes);
  app.use(`/api/${config.apiVersion}/alerts`, alertRoutes);
  app.use(`/api/${config.apiVersion}/analytics`, analyticsRoutes);
  app.use(`/api/${config.apiVersion}/ai`, aiRoutes);

  // ===== ERROR HANDLING =====
  /**
   * 404 handler - must come after all routes
   */
  app.use(notFoundHandler);

  /**
   * Global error handler - must be last middleware
   */
  app.use(errorHandler);

  return app;
}
