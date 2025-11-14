/**
 * Logger Configuration (Winston)
 *
 * WHY WINSTON?
 * - Structured logging (logs are JSON objects, easy to search)
 * - Multiple transports (console, file, external services)
 * - Log levels (error, warn, info, debug)
 * - Production-ready
 *
 * USAGE:
 * import { logger } from '@/config/logger.config';
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Database error', { error: err.message });
 */

import winston from 'winston';
import { config } from './env.config';

/**
 * Sanitize log data to remove sensitive information
 * Prevents passwords, tokens, and other secrets from appearing in logs
 */
function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  // List of sensitive field names to redact
  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
  ];

  // Clone the object to avoid mutating the original
  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    if (typeof key === 'string') {
      const lowerKey = key.toLowerCase();

      // Check if this field should be redacted
      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeLogData(sanitized[key]);
      }
    }
  }

  return sanitized;
}

/**
 * Custom log format with sanitization
 * Development: Colorized, readable
 * Production: JSON for log aggregation tools
 * SECURITY: Automatically redacts sensitive fields
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  // Sanitize sensitive data before logging
  winston.format((info) => {
    return sanitizeLogData(info);
  })(),
  winston.format.json()
);

/**
 * Console format for development (easier to read)
 * Also includes sanitization
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  // Sanitize sensitive data before logging
  winston.format((info) => {
    return sanitizeLogData(info);
  })(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return msg;
  })
);

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'kitcha-api' },
  transports: [
    // Console output (always enabled)
    // In production/Docker, we only log to console
    // Cloud platforms (Render, AWS, etc.) capture stdout/stderr automatically
    new winston.transports.Console({
      format: config.env === 'production' ? logFormat : consoleFormat,
    }),
  ],
});

/**
 * Log unhandled rejections and exceptions
 * In production, log to console (captured by cloud platform)
 * In development, you could add file logging here if needed
 */
logger.exceptions.handle(
  new winston.transports.Console({
    format: config.env === 'production' ? logFormat : consoleFormat,
  })
);

logger.rejections.handle(
  new winston.transports.Console({
    format: config.env === 'production' ? logFormat : consoleFormat,
  })
);

/**
 * Create a stream for Morgan (HTTP logger)
 * This allows Morgan to use Winston for HTTP logs
 */
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
