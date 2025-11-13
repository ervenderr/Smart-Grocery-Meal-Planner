/**
 * User & Preferences Type Definitions
 *
 * Types for user profile and preferences management.
 */

/**
 * Update user profile request
 */
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
}

/**
 * Update password request
 */
export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Update preferences request
 */
export interface UpdatePreferencesRequest {
  currency?: string;
  budgetPerWeekCents?: number;
  alertEnabled?: boolean;
  alertThresholdPercentage?: number;
  alertChannels?: string[];
  mealsPerDay?: number;
  dietaryRestrictions?: string[];
  preferredUnit?: string;
}

/**
 * User profile response
 */
export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: Date;
  lastLogin: Date | null;
}

/**
 * User preferences response
 */
export interface UserPreferencesResponse {
  id: string;
  userId: string;
  currency: string;
  budgetPerWeekCents: number;
  alertEnabled: boolean;
  alertThresholdPercentage: number;
  alertChannels: string[];
  mealsPerDay: number;
  dietaryRestrictions: string[];
  preferredUnit: string;
  createdAt: Date;
  updatedAt: Date;
}
