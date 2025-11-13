/**
 * Environment Configuration
 *
 * This file centralizes all environment variables and provides
 * type-safe access throughout the application.
 *
 * WHY: Centralizing config prevents typos, provides validation,
 * and makes it easy to see all required environment variables.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Validates that required environment variables are present
 * Throws error if any are missing - fail fast on startup
 */
function validateEnv(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'PORT'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in the values'
    );
  }
}

// Validate on module load
validateEnv();

/**
 * Export strongly-typed configuration object
 * All environment variables accessed through this object
 */
export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  database: {
    url: process.env.DATABASE_URL!,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Optional APIs (for later phases)
  apis: {
    geminiAI: process.env.GEMINI_AI_API_KEY,
    spoonacular: process.env.SPOONACULAR_API_KEY,
  },
} as const;

// Export helper to check if we're in production
export const isProduction = config.env === 'production';
export const isDevelopment = config.env === 'development';
