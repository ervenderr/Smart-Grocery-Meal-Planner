'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBasket, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { CategorySection } from '@/components/shopping/category-section';
import { FinishSheet } from '@/components/shopping/finish-sheet';
import { GenerateFromPlan } from '@/components/shopping/generate-from-plan';
import { ItemEditSheet } from '@/components/shopping/item-edit-sheet';
import { QUICK_ADD_INPUT_ID, QuickAdd, type QuickAddCallbacks } from '@/components/shopping/quick-add';
import { ShoppingHistory } from '@/components/shopping/shopping-history';
import { ShoppingModeToggle } from '@/components/shopping/shopping-mode-toggle';
import { ShoppingItemRow } from '@/components/shopping/shopping-item-row';
import { SummaryBar } from '@/components/shopping/summary-bar';
import { getApiErrorMessage } from '@/lib/api/errors';
import { useCurrency } from '@/lib/currency/currency-provider';
import { useWakeLock } from '@/lib/hooks/use-wake-lock';
import { useFinishShopping } from '@/lib/hooks/use-finish-shopping';
import {
  useAddShoppingItem,
  useDeleteShoppingItem,
  useShoppingList,
  useUpdateShoppingItem,
} from '@/lib/hooks/use-shopping-list';
import { groupItems } from '@/lib/shopping/grouping';
import { toCreateInput } from '@/lib/shopping/list-cache';
import { getShoppingLoadState } from '@/lib/shopping/load-state';
import { MAX_ITEMS_PER_LIST } from '@/lib/shopping/vocab';
import type { CarryOverMode, CreateShoppingItemInput, ShoppingItem } from '@/types/shopping.types';

const LEGACY_STORAGE_KEY = 'current-shopping-list';

export default function ShoppingPage() {
  const router = useRouter();
  const { data: list, isLoading, isError, error, refetch } = useShoppingList();
  const addItem = useAddShoppingItem();
  const updateItem = useUpdateShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const finishShopping = useFinishShopping();
  const { format } = useCurrency();
  const [finishOpen, setFinishOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [shoppingMode, setShoppingMode] = useState(false);
  const { active: wakeLockActive } = useWakeLock(shoppingMode);

  useEffect(() => {
    // The pre-persistence list lived in sessionStorage; it is dropped, not migrated.
    try {
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage may be unavailable (private mode); nothing to clean up.
    }
  }, []);

  const items = useMemo(() => list?.items ?? [], [list]);
  const groups = useMemo(() => groupItems(items), [items]);

  const toggleSection = (category: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const handleFinish = (carryOver: CarryOverMode) => {
    finishShopping.mutate(carryOver, {
      onSuccess: (result) => {
        setFinishOpen(false);
        toast.success(`Trip saved: ${format(result.history.totalCents)}`);
      },
    });
  };

  // mutateAsync (not mutate): per-call promises, so an Undo re-add on the same
  // observer cannot swallow quick-add's callbacks. Errors are toasted by the hook.
  const handleQuickAdd = (input: CreateShoppingItemInput, callbacks: QuickAddCallbacks) => {
    addItem
      .mutateAsync(input)
      .then(callbacks.onSuccess)
      .catch(() => undefined)
      .finally(callbacks.onSettled);
  };

  const handleDelete = (item: ShoppingItem) => {
    deleteItem.mutate(
      { itemId: item.id },
      {
        onSuccess: (removed) => {
          // Guard: a fast double-tap must not re-create the item twice.
          let undone = false;
          toast(
            (t) => (
              <span className="flex items-center gap-2 text-base">
                Removed {removed.itemName}
                <button
                  type="button"
                  className="min-h-11 px-2 font-semibold text-primary-600"
                  onClick={() => {
                    if (undone) return;
                    undone = true;
                    toast.dismiss(t.id);
                    addItem.mutate(toCreateInput(removed));
                  }}
                >
                  Undo
                </button>
              </span>
            ),
            { duration: 6000 }
          );
        },
      }
    );
  };

  const loadState = getShoppingLoadState({ isLoading, isError, hasData: list !== undefined });

  if (loadState === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load your shopping list"
        description={getApiErrorMessage(error, 'Check your connection and try again.')}
        actionLabel="Try again"
        onAction={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Shopping list</h1>
        <p className="text-sm text-gray-600">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
      </header>

      {loadState === 'refresh-failed' && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <span>
            Couldn&apos;t refresh your list. {getApiErrorMessage(error, 'Showing the last saved version.')}
          </span>
          <button
            type="button"
            className="min-h-11 shrink-0 px-2 font-semibold text-amber-900 underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      )}

      <ShoppingModeToggle
        enabled={shoppingMode}
        onChange={setShoppingMode}
        wakeLockActive={wakeLockActive}
      />

      {!shoppingMode && (
        <>
          <QuickAdd
            onAdd={handleQuickAdd}
            isFull={items.length >= MAX_ITEMS_PER_LIST}
          />

          <GenerateFromPlan defaultExpanded={items.length === 0} />
        </>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Your shopping list is empty"
          description="Add what you need, or build a list from a meal plan."
          actionLabel="Add item"
          onAction={() => document.getElementById(QUICK_ADD_INPUT_ID)?.focus()}
          secondaryActionLabel="Go to meal plans"
          onSecondaryAction={() => router.push('/mealplans')}
          headingLevel="h2"
        />
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <CategorySection
              key={group.category}
              id={group.category}
              label={group.label}
              uncheckedCount={group.uncheckedCount}
              totalCount={group.items.length}
              expanded={!collapsed.has(group.category)}
              onToggle={() => toggleSection(group.category)}
            >
              {group.items.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onToggle={(target) =>
                    updateItem.mutate({
                      itemId: target.id,
                      patch: { isChecked: !target.isChecked },
                    })
                  }
                  onOpen={setEditing}
                  large={shoppingMode}
                  onSetActualPrice={(cents) =>
                    updateItem.mutate({ itemId: item.id, patch: { actualCostCents: cents } })
                  }
                />
              ))}
            </CategorySection>
          ))}
        </div>
      )}

      {!shoppingMode && <ShoppingHistory />}

      {items.length > 0 && (
        <SummaryBar
          items={items}
          onFinish={() => setFinishOpen(true)}
          finishDisabled={finishShopping.isPending}
        />
      )}

      <FinishSheet
        isOpen={finishOpen}
        onClose={() => setFinishOpen(false)}
        items={items}
        onConfirm={handleFinish}
        isPending={finishShopping.isPending}
      />

      <ItemEditSheet
        item={editing}
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        onSave={(itemId, patch) => updateItem.mutate({ itemId, patch })}
        onDelete={handleDelete}
      />
    </div>
  );
}
