'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ChefHat, Loader2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/pantry/quantity-stepper';
import { CookPreviewRows } from '@/components/cook/cook-preview-rows';
import { CookNotes } from '@/components/cook/cook-notes';
import { cookApi } from '@/lib/api/cook';
import { getApiErrorCode } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query';
import { cookSuccessToast, deductionCount, toDeductions } from '@/lib/cook/preview';
import type { CookPreview, CookRow, CookTarget } from '@/types/cook.types';

interface CookedItSheetProps {
  isOpen: boolean;
  onClose: () => void;
  target: CookTarget;
  title: string;
  plannedServings?: number;
  onCooked?: () => void;
}

interface Edits {
  source: CookPreview | undefined;
  uses: Readonly<Record<string, number>>;
  unlocked: readonly string[];
  focusKey: string | null;
  edited: boolean;
}

const NO_EDITS: Edits = { source: undefined, uses: {}, unlocked: [], focusKey: null, edited: false };

const DEBOUNCE_MS = 300;
const ALREADY_COOKED_COPY = 'This meal is already marked as cooked.';
const APPLY_ERROR_COPY = "We couldn't update your pantry. Nothing was changed. Try again.";

export function CookedItSheet(props: CookedItSheetProps) {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Cooked it?" size="md">
      {props.isOpen && <CookedItBody {...props} />}
    </Modal>
  );
}

function StateBlock({
  icon,
  heading,
  body,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {icon}
      <p className="text-base font-semibold text-gray-900">{heading}</p>
      <p className="text-sm text-gray-600">{body}</p>
      {children}
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {text}
    </div>
  );
}

function CookedItBody({ onClose, target, title, plannedServings, onCooked }: CookedItSheetProps) {
  const queryClient = useQueryClient();
  const isMeal = 'mealPlanItemId' in target;
  const targetId = isMeal ? target.mealPlanItemId : target.recipeId;

  const [servings, setServings] = useState<number | null>(null);
  const [debounced, setDebounced] = useState<number | null>(null);
  const [edits, setEdits] = useState<Edits>(NO_EDITS);
  const [alreadyCooked, setAlreadyCooked] = useState(false);
  const [applyError, setApplyError] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(servings), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [servings]);

  const preview = useQuery<CookPreview>({
    queryKey: ['cook', 'preview', isMeal ? 'meal' : 'recipe', targetId, debounced],
    queryFn: () => cookApi.preview(target, debounced ?? undefined),
    placeholderData: keepPreviousData,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const data = preview.data;

  // Edits belong to one preview; a re-preview (servings change) discards them.
  const current = edits.source === data ? edits : NO_EDITS;
  const { uses, unlocked, focusKey, edited } = current;

  const editableRows: CookRow[] = useMemo(
    () => (data?.rows ?? []).filter((r) => r.status !== 'mismatch' || unlocked.includes(r.key)),
    [data, unlocked]
  );
  const mismatches = useMemo(
    () => (data?.rows ?? []).filter((r) => r.status === 'mismatch' && !unlocked.includes(r.key)),
    [data, unlocked]
  );
  const count = deductionCount(editableRows, uses);

  const apply = useMutation({
    mutationFn: () => cookApi.apply(target, toDeductions(editableRows, uses)),
    onSuccess: (result) => {
      toast.success(cookSuccessToast(result));
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
      onCooked?.();
      onClose();
    },
    onError: (error) => {
      if (getApiErrorCode(error) === 'ALREADY_COOKED') {
        setAlreadyCooked(true);
        setApplyError(false);
      } else {
        setApplyError(true);
      }
    },
  });

  const applying = apply.isPending;
  const submit = () => {
    if (applying) return;
    setApplyError(false);
    apply.mutate();
  };

  const handleUse = (key: string, value: number) => {
    setEdits({ ...current, source: data, uses: { ...uses, [key]: value }, edited: true });
  };
  const handleEnterAmount = (key: string) => {
    setEdits({ ...current, source: data, unlocked: [...unlocked, key], edited: true, focusKey: key });
  };

  const showLoading = preview.isPending;
  const showError = preview.isError && !data;
  const cooked = alreadyCooked || data?.alreadyCooked === true;
  const noIngredients = data !== undefined && data.ingredientCount === 0;
  const nothingMatches = data !== undefined && !noIngredients && data.rows.length === 0;
  const showList = data !== undefined && !noIngredients && !nothingMatches;
  const effectiveServings = servings ?? data?.servings ?? plannedServings ?? 1;

  const renderBody = () => {
    if (showLoading) {
      return (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      );
    }
    if (showError) {
      return (
        <StateBlock
          icon={<AlertCircle className="h-8 w-8 text-gray-500" aria-hidden="true" />}
          heading="Couldn't load the preview"
          body="Check your connection and try again."
        >
          <Button variant="outline" onClick={() => void preview.refetch()}>
            Try again
          </Button>
        </StateBlock>
      );
    }
    if (noIngredients) {
      return (
        <StateBlock
          icon={<ChefHat className="h-8 w-8 text-gray-500" aria-hidden="true" />}
          heading="This recipe has no ingredients"
          body="Add ingredients to the recipe to deduct them from your pantry."
        />
      );
    }
    if (nothingMatches) {
      return (
        <StateBlock
          icon={<Package className="h-8 w-8 text-gray-500" aria-hidden="true" />}
          heading="Nothing to deduct"
          body="None of these ingredients are in your pantry."
        />
      );
    }
    return null;
  };

  const primary = () => {
    if (cooked || !data || showError || noIngredients) return null;
    if (count === 0 && !isMeal) return null;
    return (
      <Button onClick={submit} disabled={applying}>
        {applying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Applying...
          </>
        ) : count > 0 ? (
          'Apply deductions'
        ) : (
          'Mark as cooked'
        )}
      </Button>
    );
  };

  const primaryButton = primary();
  const secondaryLabel = edited && primaryButton && count > 0 ? 'Discard changes' : 'Close';
  const secondaryVariant = primaryButton ? 'outline' : 'primary';

  return (
    <div className="space-y-4">
      <p className="truncate text-base text-gray-600">{title}</p>

      {cooked && <Notice text={ALREADY_COOKED_COPY} />}
      {applyError && <Notice text={APPLY_ERROR_COPY} />}

      {!cooked && !showError && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Servings you cooked</p>
          <QuantityStepper
            value={effectiveServings}
            unitLabel={effectiveServings === 1 ? 'serving' : 'servings'}
            step={1}
            min={1}
            max={99}
            label="Servings"
            onChange={setServings}
            disabled={applying || showLoading}
          />
        </div>
      )}

      {renderBody()}

      {showList && data && !cooked && (
        <>
          {editableRows.length > 0 && (
            <CookPreviewRows
              key={preview.dataUpdatedAt}
              rows={editableRows}
              uses={uses}
              onUseChange={handleUse}
              disabled={applying}
              focusKey={focusKey}
            />
          )}
          <CookNotes
            notInPantry={data.notInPantry}
            mismatches={mismatches}
            staples={data.staples}
            disabled={applying}
            onEnterAmount={handleEnterAmount}
          />
        </>
      )}
      {(nothingMatches || noIngredients) && data && !cooked && data.staples.length > 0 && (
        <CookNotes
          notInPantry={data.notInPantry}
          mismatches={[]}
          staples={data.staples}
          disabled
          onEnterAmount={() => undefined}
        />
      )}

      {!showLoading && !showError && !cooked && !noIngredients && (
        <p className="text-sm text-gray-600" aria-live="polite">
          {count > 0 ? `${count} ${count === 1 ? 'item' : 'items'} will be updated.` : 'Nothing to deduct.'}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant={secondaryVariant} onClick={onClose} disabled={applying}>
          {secondaryLabel}
        </Button>
        {primaryButton}
      </div>
    </div>
  );
}
