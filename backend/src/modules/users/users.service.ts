/**
 * Users Service
 *
 * Business logic for user profile and preferences management.
 *
 * RESPONSIBILITIES:
 * - Get/update user profile
 * - Get/update user preferences
 * - Change password
 * - Deactivate account
 */

import { prisma } from '@/config/database.config';
import { AppError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword, validatePasswordStrength } from '@/utils/password.util';
import {
  UpdateProfileRequest,
  UpdatePasswordRequest,
  UpdatePreferencesRequest,
  UserProfileResponse,
  UserPreferencesResponse,
} from '@/types/user.types';
import { logger } from '@/config/logger.config';

export class UsersService {
  /**
   * Get user profile by ID
   *
   * @param userId - User ID
   * @returns Promise<UserProfileResponse>
   * @throws AppError if user not found
   */
  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  /**
   * Update user profile
   *
   * VALIDATIONS:
   * - Email must be unique (if changing)
   * - Name fields max 50 characters
   *
   * @param userId - User ID
   * @param data - Profile update data
   * @returns Promise<UserProfileResponse>
   * @throws AppError if validation fails or email taken
   */
  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<UserProfileResponse> {
    const { email, firstName, lastName } = data;

    // If email is being changed, check if it's already taken
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError('Invalid email format', 400);
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new AppError('Email already in use', 409);
      }
    }

    // Validate name lengths
    if (firstName && firstName.length > 50) {
      throw new AppError('First name must be 50 characters or less', 400);
    }

    if (lastName && lastName.length > 50) {
      throw new AppError('Last name must be 50 characters or less', 400);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email ? email.toLowerCase() : undefined,
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    logger.info('User profile updated', { userId });

    return user;
  }

  /**
   * Get user preferences
   *
   * @param userId - User ID
   * @returns Promise<UserPreferencesResponse>
   * @throws AppError if preferences not found
   */
  async getPreferences(userId: string): Promise<UserPreferencesResponse> {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      throw new AppError('User preferences not found', 404);
    }

    return preferences;
  }

  /**
   * Update user preferences
   *
   * VALIDATIONS:
   * - budgetPerWeekCents must be positive
   * - alertThresholdPercentage must be 1-100
   * - mealsPerDay must be 1-5
   *
   * @param userId - User ID
   * @param data - Preferences update data
   * @returns Promise<UserPreferencesResponse>
   * @throws AppError if validation fails
   */
  async updatePreferences(
    userId: string,
    data: UpdatePreferencesRequest
  ): Promise<UserPreferencesResponse> {
    // Validate numeric fields
    if (data.budgetPerWeekCents !== undefined && data.budgetPerWeekCents < 0) {
      throw new AppError('Budget must be a positive number', 400);
    }

    if (
      data.alertThresholdPercentage !== undefined &&
      (data.alertThresholdPercentage < 1 || data.alertThresholdPercentage > 100)
    ) {
      throw new AppError('Alert threshold must be between 1 and 100', 400);
    }

    if (data.mealsPerDay !== undefined && (data.mealsPerDay < 1 || data.mealsPerDay > 5)) {
      throw new AppError('Meals per day must be between 1 and 5', 400);
    }

    // Update preferences
    const preferences = await prisma.userPreference.update({
      where: { userId },
      data: {
        currency: data.currency,
        budgetPerWeekCents: data.budgetPerWeekCents,
        alertEnabled: data.alertEnabled,
        alertThresholdPercentage: data.alertThresholdPercentage,
        alertChannels: data.alertChannels,
        mealsPerDay: data.mealsPerDay,
        dietaryRestrictions: data.dietaryRestrictions,
        preferredUnit: data.preferredUnit,
      },
    });

    logger.info('User preferences updated', { userId });

    return preferences;
  }

  /**
   * Change user password
   *
   * STEPS:
   * 1. Verify current password
   * 2. Validate new password strength
   * 3. Hash new password
   * 4. Update in database
   *
   * @param userId - User ID
   * @param data - Password change data
   * @returns Promise<void>
   * @throws AppError if current password is wrong or validation fails
   */
  async changePassword(userId: string, data: UpdatePasswordRequest): Promise<void> {
    const { currentPassword, newPassword } = data;

    // Get current password hash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw new AppError(passwordValidation.message!, 400);
    }

    // Check if new password is same as current
    const isSamePassword = await comparePassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new AppError('New password must be different from current password', 400);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    logger.info('User password changed', { userId });
  }

  /**
   * Deactivate user account (soft delete)
   *
   * WHAT THIS DOES:
   * - Sets isActive to false
   * - User can't login anymore
   * - Data is preserved (for analytics, audit trail)
   * - Can be reactivated by admin if needed
   *
   * WHY SOFT DELETE?
   * - Preserve shopping history, meal plans
   * - Legal/compliance requirements
   * - Accidental deletion recovery
   *
   * @param userId - User ID
   * @param password - User's password (for confirmation)
   * @returns Promise<void>
   * @throws AppError if password is wrong
   */
  async deactivateAccount(userId: string, password: string): Promise<void> {
    // Verify password before deactivation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, isActive: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.isActive) {
      throw new AppError('Account is already deactivated', 400);
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Incorrect password', 401);
    }

    // Deactivate account
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    logger.warn('User account deactivated', { userId });
  }

  /**
   * Delete user account (hard delete)
   *
   * WARNING: This permanently deletes all user data!
   * Use only if required by law (GDPR right to be forgotten)
   *
   * @param userId - User ID
   * @param password - User's password (for confirmation)
   * @returns Promise<void>
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Incorrect password', 401);
    }

    // Delete user (CASCADE will delete related data)
    await prisma.user.delete({
      where: { id: userId },
    });

    logger.warn('User account permanently deleted', { userId });
  }
}

// Export singleton instance
export const usersService = new UsersService();
