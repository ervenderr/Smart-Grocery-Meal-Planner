'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { pantryApi } from '@/lib/api/pantry';
import { preferencesApi } from '@/lib/api/preferences';
import { PREFERENCES_QUERY_KEY } from '@/lib/hooks/use-preferences';
import { DEFAULT_CURRENCY } from '@/lib/currency/format';
import { parseBudgetInput } from '@/lib/currency/budget';
import { buildOnboardingItem } from '@/lib/onboarding/onboarding';
import { classifyOnboardingError, findAlreadyCreated } from '@/lib/onboarding/errors';
import { cn } from '@/lib/utils';
import { StepBudget, BUDGET_STEP_TITLE, budgetError } from './step-budget';
import { StepDietary, DIETARY_STEP_TITLE } from './step-dietary';
import { StepPantry, PANTRY_STEP_TITLE } from './step-pantry';

const TOTAL_STEPS = 3;
const STEP_TITLES = [BUDGET_STEP_TITLE, DIETARY_STEP_TITLE, PANTRY_STEP_TITLE] as const;

interface FlowState {
  step: number;
  currency: string;
  budgetInput: string;
  dietary: string[];
  items: string[];
  createdNames: string[];
  /** Names whose create may have succeeded server-side but was not confirmed. */
  pendingNames: string[];
  prefsSaved: boolean;
  showErrors: boolean;
  saving: boolean;
  error: string | null;
  errorRetryable: boolean;
}

interface OnboardingFlowProps {
  initial?: { currency?: string };
}

export function OnboardingFlow({ initial }: OnboardingFlowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<FlowState>({
    step: 0,
    currency: initial?.currency || DEFAULT_CURRENCY,
    budgetInput: '',
    dietary: [],
    items: [],
    createdNames: [],
    pendingNames: [],
    prefsSaved: false,
    showErrors: false,
    saving: false,
    error: null,
    errorRetryable: true,
  });

  const patch = (next: Partial<FlowState>) => setState((s) => ({ ...s, ...next }));
  const isLast = state.step === TOTAL_STEPS - 1;

  const markComplete = async () => {
    const result = await preferencesApi.completeOnboarding();
    queryClient.setQueryData(PREFERENCES_QUERY_KEY, result);
  };

  /** On retry, drop pending names that already exist so a lost response never duplicates. */
  const confirmPending = async (pending: string[]): Promise<string[]> => {
    const existing: string[] = [];
    for (const name of pending) {
      const { items } = await pantryApi.getAll({ search: name, limit: 50 });
      existing.push(...findAlreadyCreated([name], items));
    }
    return existing;
  };

  const saveItems = async (): Promise<string[]> => {
    const alreadyThere = await confirmPending(state.pendingNames);
    let created = [...state.createdNames, ...alreadyThere];
    let pending = state.pendingNames.filter((n) => !alreadyThere.includes(n));
    const rejected: string[] = [];
    patch({ createdNames: created, pendingNames: pending });
    for (const name of state.items) {
      if (created.includes(name)) continue;
      const data = buildOnboardingItem(name);
      if (!data) continue;
      try {
        await pantryApi.create(data);
        created = [...created, name];
        pending = pending.filter((n) => n !== name);
        patch({ createdNames: created, pendingNames: pending });
      } catch (itemError) {
        if (classifyOnboardingError(itemError).retryable) {
          patch({ pendingNames: [...pending.filter((n) => n !== name), name] });
          throw itemError;
        }
        // A rejected item (validation, conflict) is skipped; it would fail every retry
        console.error(`Onboarding: could not add "${name}":`, itemError);
        rejected.push(name);
      }
    }
    return rejected;
  };

  const fail = (error: unknown) => {
    console.error('Onboarding save failed:', error);
    const failure = classifyOnboardingError(error);
    patch({ saving: false, error: failure.message, errorRetryable: failure.retryable });
  };

  const finish = async () => {
    patch({ saving: true, error: null });
    try {
      if (!state.prefsSaved) {
        const parsedBudget =
          state.budgetInput.trim() === ''
            ? null
            : parseBudgetInput(state.budgetInput, state.currency);
        const budget = parsedBudget?.ok ? parsedBudget.cents : null;
        await preferencesApi.update({
          currency: state.currency,
          dietaryRestrictions: state.dietary,
          ...(budget != null ? { budgetPerWeekCents: budget } : {}),
        });
        patch({ prefsSaved: true });
      }
      const rejected = await saveItems();
      await markComplete();
      toast.success("You're all set! Welcome to Kitcha.");
      if (rejected.length > 0) {
        toast.error(`We couldn't add: ${rejected.join(', ')}. You can add them from Pantry.`);
      }
      router.push('/dashboard');
    } catch (error) {
      fail(error);
    }
  };

  const skip = async () => {
    patch({ saving: true, error: null });
    try {
      await markComplete();
    } catch (error) {
      fail(error);
    }
  };

  const next = () => {
    if (state.step === 0 && budgetError(state.budgetInput, state.currency)) {
      patch({ showErrors: true });
      return;
    }
    if (isLast) {
      void finish();
      return;
    }
    patch({ step: state.step + 1, error: null });
  };

  const primaryLabel = ['Continue to dietary needs', 'Continue to pantry'][state.step]
    ?? (state.items.length === 0 ? 'Skip and finish' : 'Finish setup');

  const toggleDietary = (value: string) =>
    patch({
      prefsSaved: false,
      dietary: state.dietary.includes(value)
        ? state.dietary.filter((v) => v !== value)
        : [...state.dietary, value],
    });

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 h-dvh bg-white pt-safe pb-safe animate-fade-in"
        >
          <div className="mx-auto flex h-full max-w-md flex-col px-4">
            <div className="flex min-h-14 items-center justify-between gap-2">
              <Image src="/kitcha-logo.svg" alt="Kitcha" width={32} height={32} priority />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Step {state.step + 1} of {TOTAL_STEPS}
                </span>
                <div className="flex gap-1" aria-hidden="true">
                  {STEP_TITLES.map((title, i) => (
                    <span
                      key={title}
                      className={cn(
                        'h-2 rounded-full',
                        i === state.step ? 'w-6 bg-primary-500' : 'w-2 bg-gray-200'
                      )}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void skip()}
                disabled={state.saving}
                className="min-h-11 px-2 text-sm font-semibold text-gray-600 disabled:opacity-50"
              >
                Skip setup
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <Dialog.Title className="mb-4 text-2xl font-semibold text-gray-900">
                {STEP_TITLES[state.step]}
              </Dialog.Title>
              <div key={state.step} className="animate-fade-in">
                {state.step === 0 && (
                  <StepBudget
                    currency={state.currency}
                    budgetInput={state.budgetInput}
                    showErrors={state.showErrors}
                    onCurrencyChange={(currency) => patch({ currency, prefsSaved: false })}
                    onBudgetChange={(budgetInput) => patch({ budgetInput, prefsSaved: false })}
                  />
                )}
                {state.step === 1 && (
                  <StepDietary selected={state.dietary} onToggle={toggleDietary} />
                )}
                {state.step === 2 && (
                  <StepPantry items={state.items} onItemsChange={(items) => patch({ items })} />
                )}
              </div>
            </div>

            <div className="space-y-2 pb-4">
              {state.error && (
                <p role="alert" className="text-sm text-red-600">
                  {state.error}
                </p>
              )}
              {state.error && !state.errorRetryable && (
                <Button variant="outline" size="lg" fullWidth onClick={() => void skip()}>
                  Continue without saving
                </Button>
              )}
              <div className="flex flex-col gap-2">
                <Button size="lg" fullWidth loading={state.saving} onClick={next}>
                  {primaryLabel}
                </Button>
                {state.step > 0 && (
                  <Button
                    variant="ghost"
                    size="lg"
                    fullWidth
                    disabled={state.saving}
                    onClick={() => patch({ step: state.step - 1, error: null })}
                  >
                    Back
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
