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
 * Custom log format
 * Development: Colorized, readable
 * Production: JSON for log aggregation tools
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Console format for development (easier to read)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
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
