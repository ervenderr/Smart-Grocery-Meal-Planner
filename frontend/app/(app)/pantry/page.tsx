'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Package, AlertCircle, AlertTriangle, ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { AddPantryItemModal } from '@/components/pantry/add-pantry-item-modal';
import { EditPantryItemModal } from '@/components/pantry/edit-pantry-item-modal';
import { ScanSheet } from '@/components/pantry/scan/scan-sheet';
import { PantryItemCard } from '@/components/pantry/pantry-item-card';
import { pantryApi } from '@/lib/api/pantry';
import { queryKeys } from '@/lib/react-query';
import { sortUsedUpLast } from '@/lib/pantry/quantity';
import {
  useDeferredRemove,
  usePantryList,
  usePantryPatch,
  type PantryQuickPatch,
} from '@/lib/hooks/use-pantry';
import toast from 'react-hot-toast';
import { prefillFromOwnItem, prefillFromProduct } from '@/lib/scan/prefill';
import type { BarcodeResolution } from '@/lib/scan/resolve-barcode';
import type { FoodAttribution } from '@/lib/api/food';
import type { CreatePantryItemData, PantryItem } from '@/types/pantry.types';

interface AddPrefill {
  initialValues?: Partial<CreatePantryItemData>;
  notice: 'own' | null;
  attribution: FoodAttribution | null;
  focusName: boolean;
}

const EMPTY_PREFILL: AddPrefill = { notice: null, attribution: null, focusName: false };

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'protein', label: 'Protein' },
  { value: 'vegetable', label: 'Vegetables' },
  { value: 'fruit', label: 'Fruits' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'grains', label: 'Grains' },
  { value: 'spices', label: 'Spices' },
  { value: 'canned', label: 'Canned Goods' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'condiments', label: 'Condiments' },
  { value: 'other', label: 'Other' },
];

export default function PantryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<AddPrefill>(EMPTY_PREFILL);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PantryItem | null>(null);

  const {
    data: fetched,
    isLoading: loading,
    isError: loadError,
    refetch,
  } = usePantryList({ category: selectedCategory, search: appliedSearch });
  const patchMutation = usePantryPatch();
  const { remove: removeUsedUp } = useDeferredRemove();

  const items = useMemo(() => sortUsedUpLast(fetched ?? []), [fetched]);

  const refreshItems = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });

  const handleClearFilters = () => {
    setSearchQuery('');
    setAppliedSearch('');
    setSelectedCategory('');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchQuery.trim());
  };

  const handlePatch = async (item: PantryItem, patch: PantryQuickPatch) => {
    try {
      await patchMutation.mutateAsync({ id: item.id, patch });
    } catch (error) {
      toast.error(`Couldn't update ${item.ingredientName}. Your change was undone.`);
      throw error;
    }
  };

  const openAdd = () => {
    setAddPrefill(EMPTY_PREFILL);
    setShowAddModal(true);
  };

  const handleScanResolved = (resolution: BarcodeResolution) => {
    if (resolution.kind === 'found') {
      setAddPrefill({
        initialValues: prefillFromProduct(resolution.product, resolution.barcode),
        notice: null,
        attribution: resolution.attribution,
        focusName: false,
      });
      toast.success('Product found. Check the details and save.');
    } else if (resolution.kind === 'own') {
      setAddPrefill({
        initialValues: prefillFromOwnItem(resolution.item),
        notice: 'own',
        attribution: null,
        focusName: false,
      });
    } else {
      setAddPrefill({
        initialValues: { barcode: resolution.barcode },
        notice: null,
        attribution: null,
        focusName: true,
      });
    }
    setShowAddModal(true);
  };

  const handleEdit = (item: PantryItem) => {
    setEditingItem(item);
    setShowEditModal(true);
  };

  const handleDelete = async (item: PantryItem) => {
    if (deleteConfirm?.id === item.id) {
      try {
        await pantryApi.delete(item.id);
        toast.success('Item deleted successfully');
        await refreshItems();
        setDeleteConfirm(null);
      } catch (error: any) {
        console.error('Delete error:', error);
        toast.error('Failed to delete item');
      }
    } else {
      setDeleteConfirm(item);
      setTimeout(() => setDeleteConfirm(null), 3000);
      toast('Click delete again to confirm', { icon: '⚠️' });
    }
  };

  const getExpiringCount = () => {
    const today = new Date();
    return items.filter((item) => {
      if (!item.expiryDate) return false;
      const daysUntilExpiry = Math.ceil(
        (new Date(item.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
    }).length;
  };

  const expiringCount = getExpiringCount();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Pantry</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your pantry inventory and track expiration dates
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 sm:flex-none" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Scan barcode"
            onClick={() => setScanOpen(true)}
          >
            <ScanBarcode className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {expiringCount > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900">
                {expiringCount} item{expiringCount > 1 ? 's' : ''} expiring soon
              </h3>
              <p className="text-sm text-amber-700">
                Check your pantry to avoid food waste
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-base lg:text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </form>

          {/* Category Filter */}
          <div
            role="group"
            aria-label="Filter by category"
            className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 sm:max-w-md"
          >
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                    active
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Items Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : loadError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load your pantry"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      ) : items.length === 0 ? (
        appliedSearch || selectedCategory ? (
          <EmptyState
            icon={Search}
            title="No matching items"
            description="Try a different search or clear the filters."
            actionLabel="Clear filters"
            onAction={handleClearFilters}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="Your pantry is empty"
            description="Add what you have at home to track expiry dates and get recipe ideas."
            actionLabel="Add first item"
            onAction={openAdd}
            secondaryActionLabel="Scan a barcode"
            onSecondaryAction={() => setScanOpen(true)}
          />
        )
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <PantryItemCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPatch={handlePatch}
              onRemoveUsedUp={removeUsedUp}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddPantryItemModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddPrefill(EMPTY_PREFILL);
        }}
        onSuccess={() => void refreshItems()}
        initialValues={addPrefill.initialValues}
        notice={addPrefill.notice}
        attribution={addPrefill.attribution}
        focusName={addPrefill.focusName}
        onScanBarcode={() => setScanOpen(true)}
      />

      <ScanSheet
        isOpen={scanOpen}
        mode="lookup"
        onClose={() => setScanOpen(false)}
        onResolved={handleScanResolved}
        onAddWithoutBarcode={openAdd}
      />

      <EditPantryItemModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        onSuccess={() => void refreshItems()}
        item={editingItem}
      />
    </div>
  );
}
