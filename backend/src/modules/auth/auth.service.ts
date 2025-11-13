/**
 * Authentication Service
 *
 * Business logic for user authentication.
 * This is where the "work" happens - database queries, validation, etc.
 *
 * ARCHITECTURE:
 * Controller → Service → Database
 * - Controller: Handles HTTP (req/res)
 * - Service: Business logic (this file)
 * - Database: Data persistence (Prisma)
 *
 * WHY SEPARATE SERVICE?
 * - Testable (mock database easily)
 * - Reusable (can call from different controllers)
 * - Clean (controller stays thin)
 */

import { prisma } from '@/config/database.config';
import { AppError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword, validatePasswordStrength } from '@/utils/password.util';
import { generateToken } from '@/utils/jwt.util';
import { SignupRequest, LoginRequest, AuthResponse } from '@/types/auth.types';
import { logger } from '@/config/logger.config';

export class AuthService {
  /**
   * Register a new user
   *
   * STEPS:
   * 1. Validate input (password strength, email format)
   * 2. Check if user already exists
   * 3. Hash password
   * 4. Create user in database
   * 5. Generate JWT token
   * 6. Return user + token
   *
   * @param data - Signup form data
   * @returns Promise<AuthResponse> - User info + JWT token
   * @throws AppError if validation fails or user exists
   */
  async signup(data: SignupRequest): Promise<AuthResponse> {
    const { email, password, firstName, lastName } = data;

    // 1. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Invalid email format', 400);
    }

    // 2. Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      throw new AppError(passwordValidation.message!, 400);
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 409); // 409 = Conflict
    }

    // 4. Hash password (NEVER store plain text!)
    const passwordHash = await hashPassword(password);

    // 5. Create user in database
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(), // Always store lowercase for consistency
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        lastLogin: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    // 6. Create default preferences for user
    await prisma.userPreference.create({
      data: {
        userId: user.id,
        // All other fields use schema defaults
      },
    });

    // 7. Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    logger.info('User registered successfully', {
      userId: user.id,
      email: user.email,
    });

    // 8. Return response
    return {
      user,
      token,
      expiresIn: '7d',
    };
  }

  /**
   * Login existing user
   *
   * STEPS:
   * 1. Find user by email
   * 2. Check if user exists
   * 3. Compare passwords
   * 4. Update last login time
   * 5. Generate JWT token
   * 6. Return user + token
   *
   * @param data - Login credentials
   * @returns Promise<AuthResponse> - User info + JWT token
   * @throws AppError if credentials are invalid
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const { email, password } = data;

    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        isActive: true,
        createdAt: true,
      },
    });

    // 2. Check if user exists
    if (!user) {
      // SECURITY: Don't reveal if email exists
      // Same error message for "user not found" and "wrong password"
      throw new AppError('Invalid email or password', 401);
    }

    // 3. Check if account is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    // 4. Compare passwords
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // 5. Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // 6. Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
    });

    // 7. Return response (exclude password hash!)
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      },
      token,
      expiresIn: '7d',
    };
  }

  /**
   * Get user profile by ID
   *
   * Used by JWT middleware to verify user still exists
   *
   * @param userId - User ID from JWT token
   * @returns Promise<User | null>
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Verify user credentials (for sensitive operations)
   *
   * Use case: Before deleting account, changing password, etc.
   *
   * @param userId - User ID
   * @param password - Current password
   * @returns Promise<boolean> - True if password matches
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return false;
    }

    return comparePassword(password, user.passwordHash);
  }
}

// Export singleton instance
export const authService = new AuthService();
