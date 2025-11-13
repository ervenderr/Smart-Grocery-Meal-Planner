/**
 * Authentication Types
 */

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  currency: string;
  budgetPerWeek: number; // in cents
  alertThresholdPercentage: number;
  alertEnabled: boolean;
  alertChannels: string[];
  mealsPerDay: number;
  dietaryRestrictions: string[];
  preferredUnit: 'kg' | 'lb';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
