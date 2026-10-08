export interface UserPreferences {
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
  /** Optional: an older backend omits this field. */
  onboardingCompletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdatePreferencesData = Partial<
  Pick<
    UserPreferences,
    | 'currency'
    | 'budgetPerWeekCents'
    | 'alertEnabled'
    | 'alertThresholdPercentage'
    | 'alertChannels'
    | 'mealsPerDay'
    | 'dietaryRestrictions'
    | 'preferredUnit'
  >
>;
