'use client';

import { usePreferences } from '@/lib/hooks/use-preferences';
import { shouldShowOnboarding } from '@/lib/onboarding/onboarding';
import { OnboardingFlow } from './onboarding-flow';

/** Renders onboarding only for a new user; fails open on error or missing data. */
export function OnboardingGate() {
  const { data, isError } = usePreferences();
  if (isError || !shouldShowOnboarding(data)) return null;
  return <OnboardingFlow initial={{ currency: data?.currency }} />;
}
