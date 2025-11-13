/**
 * Users Controller
 *
 * Handles HTTP requests for user profile and preferences.
 */

import { Request, Response } from 'express';
import { usersService } from './users.service';
import {
  UpdateProfileRequest,
  UpdatePasswordRequest,
  UpdatePreferencesRequest,
} from '@/types/user.types';

export class UsersController {
  /**
   * GET /api/v1/users/profile
   * Get current user's profile
   *
   * HEADERS:
   * Authorization: Bearer <token>
   *
   * RESPONSE (200):
   * {
   *   "id": "uuid",
   *   "email": "user@example.com",
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "isActive": true,
   *   "createdAt": "2024-01-01T00:00:00.000Z",
   *   "lastLogin": "2024-01-02T00:00:00.000Z"
   * }
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;

    const profile = await usersService.getProfile(userId);

    res.status(200).json(profile);
  }

  /**
   * PATCH /api/v1/users/profile
   * Update current user's profile
   *
   * HEADERS:
   * Authorization: Bearer <token>
   *
   * BODY:
   * {
   *   "firstName": "John",      // optional
   *   "lastName": "Doe",        // optional
   *   "email": "new@email.com"  // optional
   * }
   *
   * RESPONSE (200):
   * Updated profile object
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const data: UpdateProfileRequest = req.body;

    const profile = await usersService.updateProfile(userId, data);

    res.status(200).json(profile);
  }

  /**
   * GET /api/v1/users/preferences
   * Get current user's preferences
   *
   * HEADERS:
   * Authorization: Bearer <token>
   *
   * RESPONSE (200):
   * {
   *   "id": "uuid",
   *   "userId": "uuid",
   *   "currency": "USD",
   *   "budgetPerWeekCents": 10000,
   *   "alertEnabled": true,
   *   "alertThresholdPercentage": 90,
   *   "alertChannels": ["in_app"],
   *   "mealsPerDay": 3,
   *   "dietaryRestrictions": [],
   *   "preferredUnit": "kg",
   *   "createdAt": "...",
   *   "updatedAt": "..."
   * }
   */
  async getPreferences(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;

    const preferences = await usersService.getPreferences(userId);

    res.status(200).json(preferences);
  }

  /**
   * PATCH /api/v1/users/preferences
   * Update current user's preferences
   *
   * HEADERS:
   * Authorization: Bearer <token>
   *
   * BODY (all fields optional):
   * {
   *   "currency": "USD",
   *   "budgetPerWeekCents": 15000,
   *   "alertEnabled": true,
   *   "alertThresholdPercentage": 85,
   *   "alertChannels": ["in_app", "email"],
   *   "mealsPerDay": 3,
   *   "dietaryRestrictions": ["vegan", "gluten-free"],
   *   "preferredUnit": "lb"
   * }
   *
   * RESPONSE (200):
   * Updated preferences object
   */
  async updatePreferences(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const data: UpdatePreferencesRequest = req.body;

    const preferences = await usersService.updatePreferences(userId, data);

    res.status(200).json(preferences);
  }

  /**
   * PATCH /api/v1/users/password
   * Change user password
   *
   * HEADERS:
   * Authorization: Bearer <token>
   *
   * BODY:
   * {
   *   "currentPassword": "OldPass123",
   *   "newPassword": "NewPass456"
   * }
   *
   * RESPONSE (200):
   * {
   *   "message": "Password changed successfully"
   * }
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const data: UpdatePasswordRequest = req.body;

    await usersService.changePassword(userId, data);

    res.status(200).json({
      message: 'Password changed successfully',
    });
  }

  /**
   * DELETE /api/v1/users/account
   * Deactivate user account
   *
   * HEADERS:
   * Authorization: Bearer <token>
   *
   * BODY:
   * {
   *   "password": "UserPass123"
   * }
   *
   * RESPONSE (200):
   * {
   *   "message": "Account deactivated successfully"
   * }
   */
  async deactivateAccount(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const { password } = req.body;

    await usersService.deactivateAccount(userId, password);

    res.status(200).json({
      message: 'Account deactivated successfully',
    });
  }
}

// Export singleton instance
export const usersController = new UsersController();
