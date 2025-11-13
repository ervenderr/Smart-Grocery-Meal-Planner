/**
 * Application Entry Point
 *
 * This file starts the Express server and handles graceful shutdown.
 *
 * WHAT HAPPENS HERE:
 * 1. Load environment variables
 * 2. Create Express app
 * 3. Start HTTP server
 * 4. Handle shutdown signals (SIGTERM, SIGINT)
 */

import { createApp } from './app';
import { config } from './config/env.config';
import { logger } from './config/logger.config';
import { connectDatabase, disconnectDatabase } from './config/database.config';

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // 1. Connect to database first
    await connectDatabase();

    // 2. Create Express app
    const app = createApp();

    // 3. Start listening
    const server = app.listen(config.port, () => {
      logger.info('🚀 Server started successfully', {
        port: config.port,
        environment: config.env,
        nodeVersion: process.version,
      });

      logger.info('📋 Available endpoints:', {
        health: `http://localhost:${config.port}/health`,
        api: `http://localhost:${config.port}/api/${config.apiVersion}`,
      });
    });

    // ===== GRACEFUL SHUTDOWN =====
    /**
     * Handle shutdown signals (Ctrl+C, kill command, etc.)
     * Ensures all connections are closed properly before exit
     */
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        // Close database connections
        await disconnectDatabase();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // ===== UNHANDLED ERRORS =====
    /**
     * Catch any unhandled promise rejections
     * These should never happen, but we log them for debugging
     */
    process.on('unhandledRejection', (reason: Error) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason.message,
        stack: reason.stack,
      });
      // In production, you might want to restart the process
      // process.exit(1);
    });

    /**
     * Catch any uncaught exceptions
     */
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      // Must exit on uncaught exception
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer();
