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
import fs from 'fs';

// Load environment variables from .env file (development only)
// In production (Render, etc.), environment variables are provided by the platform
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // In production, just load from process.env
  dotenv.config();
}

/**
 * Validates that required environment variables are present
 * Throws error if any are missing - fail fast on startup
 */
function validateEnv(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'PORT'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const errorMsg =
      `❌ Missing required environment variables: ${missing.join(', ')}\n` +
      `Environment: ${process.env.NODE_ENV || 'not set'}\n` +
      `Available env vars: ${Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('PASSWORD')).join(', ')}\n` +
      'Please ensure all required environment variables are set in your deployment platform or .env file';

    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

// Validate on module load
try {
  validateEnv();
  console.log('✅ Environment validation passed');
} catch (error) {
  console.error('❌ Environment validation failed:', error);
  throw error;
}

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
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim()),
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
