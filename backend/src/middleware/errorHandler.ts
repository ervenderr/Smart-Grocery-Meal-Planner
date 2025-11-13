/**
 * Global Error Handler Middleware
 *
 * WHY THIS EXISTS:
 * - Centralizes error handling (don't repeat try-catch everywhere)
 * - Provides consistent error responses to frontend
 * - Logs errors for debugging
 * - Prevents sensitive info leakage in production
 *
 * HOW IT WORKS:
 * 1. Any error thrown in routes/controllers comes here
 * 2. We determine the error type (validation, not found, server error)
 * 3. We format a clean response to send to client
 * 4. We log the full error for debugging
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/config/logger.config';
import { isProduction } from '@/config/env.config';

/**
 * Custom error class with status code
 * Use this to throw errors with specific HTTP status codes
 *
 * Example:
 * throw new AppError('User not found', 404);
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Standard error response format
 * Frontend can rely on this structure
 */
interface ErrorResponse {
  status: 'error';
  statusCode: number;
  message: string;
  errors?: any[];
  stack?: string; // Only in development
}

/**
 * Main error handler middleware
 * Must be last middleware in the chain
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Default to 500 if no status code
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: any[] | undefined;

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // Handle validation errors (express-validator)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errors = (err as any).errors;
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }
  // Handle Prisma errors (database)
  else if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';

    // Prisma error codes
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      message = 'A record with this value already exists';
    } else if (prismaError.code === 'P2025') {
      message = 'Record not found';
      statusCode = 404;
    }
  }
  // Generic error
  else {
    message = err.message || 'Something went wrong';
  }

  // Log the error (with full stack trace for debugging)
  logger.error('Error occurred', {
    message: err.message,
    statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id, // If authenticated
  });

  // Build response
  const response: ErrorResponse = {
    status: 'error',
    statusCode,
    message,
  };

  // Include validation errors if present
  if (errors) {
    response.errors = errors;
  }

  // Include stack trace in development (helps debugging)
  if (!isProduction) {
    response.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 * Catches all undefined routes
 *
 * Place this BEFORE the error handler but AFTER all routes
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404
  );
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 *
 * USAGE:
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await getUsers(); // If this throws, error handler catches it
 *   res.json(users);
 * }));
 *
 * WHY: Without this, you'd need try-catch in every async route
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, _res, next)).catch(next);
  };
};
