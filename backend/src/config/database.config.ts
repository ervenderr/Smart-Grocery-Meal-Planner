/**
 * Database Client Configuration (Prisma)
 *
 * This file creates and exports a singleton Prisma client instance.
 *
 * WHY SINGLETON?
 * - Prisma manages connection pooling internally
 * - Creating multiple clients wastes connections
 * - Single instance shared across the entire app
 *
 * WHY THIS PATTERN?
 * - Easy to mock in tests (just import { prisma } and mock it)
 * - Centralized configuration
 * - Clean disconnection on shutdown
 *
 * USAGE:
 * import { prisma } from '@/config/database.config';
 * const users = await prisma.user.findMany();
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger.config';
import { isDevelopment } from './env.config';

/**
 * Prisma Client Options
 * - log: What to log (queries, errors, etc.)
 * - errorFormat: How to format errors
 */
const prismaOptions = {
  log: isDevelopment
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ]
    : [{ emit: 'event', level: 'error' }],
  errorFormat: 'pretty' as const,
};

/**
 * Create Prisma Client instance
 * This is a singleton - only created once
 */
const createPrismaClient = () => {
  const client = new PrismaClient(prismaOptions as any);

  // Log queries in development (helpful for debugging)
  if (isDevelopment) {
    client.$on('query' as never, ((e: any) => {
      logger.debug('Prisma Query', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    }) as never);
  }

  // Log errors (production and development)
  client.$on('error' as never, ((e: any) => {
    logger.error('Prisma Error', {
      message: e.message,
      target: e.target,
    });
  }) as never);

  // Log warnings
  client.$on('warn' as never, ((e: any) => {
    logger.warn('Prisma Warning', {
      message: e.message,
    });
  }) as never);

  return client;
};

/**
 * Global singleton instance
 * In development, we prevent multiple instances due to hot reloading
 */
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || createPrismaClient();

if (isDevelopment) {
  global.prisma = prisma;
}

/**
 * Connect to database
 * Call this on server startup
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Test the connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection tested');
  } catch (error) {
    logger.error('❌ Failed to connect to database', { error });
    throw error;
  }
}

/**
 * Disconnect from database
 * Call this on server shutdown (graceful shutdown)
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting from database', { error });
  }
}

/**
 * Health check for database
 * Returns true if database is reachable
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}
