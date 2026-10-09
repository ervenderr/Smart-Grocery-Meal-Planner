'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScanBarcode } from 'lucide-react';
import { pantryApi } from '@/lib/api/pantry';
import { ScanSheet } from '@/components/pantry/scan/scan-sheet';
import { mergeScanIntoForm } from '@/lib/scan/merge-scan';
import { prefillFromOwnItem, prefillFromProduct } from '@/lib/scan/prefill';
import type { BarcodeResolution } from '@/lib/scan/resolve-barcode';
import { BarcodeLookup } from '@/components/food/barcode-lookup';
import { BarcodeField } from '@/components/pantry/barcode-field';
import { FoodDataAttribution } from '@/components/food/food-data-attribution';
import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import toast from 'react-hot-toast';
import type {
  CreatePantryItemData,
  PantryItemCategory,
  PantryItemUnit,
} from '@/types/pantry.types';

const pantryItemSchema = z.object({
  ingredientName: z.string().min(1, 'Item name is required'),
  category: z.string().min(1, 'Category is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  expiryDate: z.string().optional(),
  purchaseDate: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  barcode: z
    .string()
    .regex(/^\d{8,14}$/, 'Barcode must be 8 to 14 digits.')
    .optional()
    .or(z.literal('')),
});

type PantryItemFormData = z.infer<typeof pantryItemSchema>;

interface AddPantryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Prefill values; the form resets from these each time the modal opens. */
  initialValues?: Partial<CreatePantryItemData>;
  /** 'own' shows the repeat-scan banner. */
  notice?: 'own' | null;
  attribution?: FoodAttribution | null;
  focusName?: boolean;
  /** Rendered directly under the title (the scan flow puts its button here). */
  headerSlot?: ReactNode;
  /** Shows the full-width "Scan barcode" button; the scan sheet is nested in this modal. */
  enableScan?: boolean;
}

const categories: { value: PantryItemCategory; label: string }[] = [
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

const units: { value: PantryItemUnit; label: string }[] = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'lbs', label: 'Pounds (lbs)' },
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'liters', label: 'Liters (L)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'cups', label: 'Cups' },
  { value: 'tbsp', label: 'Tablespoons' },
  { value: 'tsp', label: 'Teaspoons' },
  { value: 'fl_oz', label: 'Fluid Ounces' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'items', label: 'Items' },
];

export function AddPantryItemModal({
  isOpen,
  onClose,
  onSuccess,
  initialValues,
  notice = null,
  attribution = null,
  focusName = false,
  headerSlot,
  enableScan = false,
}: AddPantryItemModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanAttribution, setScanAttribution] = useState<FoodAttribution | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    setFocus,
    formState: { errors, dirtyFields },
    reset,
  } = useForm<PantryItemFormData>({
    resolver: zodResolver(pantryItemSchema),
  });

  const initialRef = useRef(initialValues);
  initialRef.current = initialValues;
  const initialKey = JSON.stringify(initialValues ?? {});

  useEffect(() => {
    if (!isOpen) return;
    reset({ ...initialRef.current });
    if (focusName) {
      const timer = setTimeout(() => setFocus('ingredientName'), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialKey, focusName, reset, setFocus]);

  const barcodeValue = watch('barcode') ?? '';

  const NAME_MAX_LENGTH = 100;

  const handleProductFound = (product: FoodProduct) => {
    const fullName = product.brand ? `${product.name} (${product.brand})` : product.name;
    const name =
      fullName.length <= NAME_MAX_LENGTH ? fullName : product.name.slice(0, NAME_MAX_LENGTH);
    setValue('ingredientName', name, { shouldValidate: true });
    setValue('category', product.suggestedCategory, { shouldValidate: true });
    if (product.barcode) setValue('barcode', product.barcode, { shouldValidate: true });
  };

  // Merge into the open form (never reset) so typed input survives a scan.
  const handleScanResolved = (resolution: BarcodeResolution) => {
    if (resolution.kind === 'failed') return;
    const incoming =
      resolution.kind === 'found'
        ? prefillFromProduct(resolution.product, resolution.barcode)
        : resolution.kind === 'own'
          ? prefillFromOwnItem(resolution.item)
          : { barcode: resolution.barcode };
    const patch = mergeScanIntoForm(getValues(), incoming, {
      dirtyFields: new Set(
        Object.keys(dirtyFields).filter((k) => dirtyFields[k as keyof typeof dirtyFields])
      ),
    });
    (Object.keys(patch) as (keyof typeof patch)[]).forEach((key) =>
      setValue(key, patch[key] as never, { shouldValidate: true, shouldDirty: true })
    );
    setScanAttribution(resolution.kind === 'found' ? resolution.attribution : null);
    if (resolution.kind === 'found') toast.success('Product found. Check the details and save.');
    else if (resolution.kind === 'own')
      toast.success("You've added this before. Details filled in from your pantry.");
    else toast("We don't know this product yet. Barcode saved, add the details yourself.");
  };

  const onSubmit = async (data: PantryItemFormData) => {
    setIsLoading(true);

    try {
      await pantryApi.create({
        ingredientName: data.ingredientName,
        category: data.category as PantryItemCategory,
        quantity: data.quantity,
        unit: data.unit as PantryItemUnit,
        expiryDate: data.expiryDate || undefined,
        purchaseDate: data.purchaseDate || undefined,
        location: (data.location as any) || undefined,
        notes: data.notes || undefined,
        barcode: data.barcode || undefined,
      });

      toast.success('Pantry item added successfully!');
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Add pantry item error:', error);
      const errorMessage =
        error?.response?.data?.message || 'Failed to add item. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      reset();
      setScanAttribution(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Pantry Item" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {headerSlot}
        {enableScan && (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={isLoading}
            onClick={() => setScanOpen(true)}
          >
            <ScanBarcode className="h-5 w-5" aria-hidden="true" />
            Scan barcode
          </Button>
        )}
        {notice === 'own' && (
          <p className="bg-primary-50 text-primary-700 rounded-lg p-2 text-sm">
            You&apos;ve added this before. Details filled in from your pantry.
          </p>
        )}

        {/* Basic Information Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wide text-gray-900 uppercase">
            Basic Information
          </h3>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900">
              Look up by barcode (optional)
            </label>
            <BarcodeLookup onFound={handleProductFound} disabled={isLoading} />
          </div>

          <Input
            label="Item Name"
            placeholder="e.g., Milk, Eggs, Rice"
            error={errors.ingredientName?.message}
            disabled={isLoading}
            required
            {...register('ingredientName')}
          />

          <BarcodeField
            collapsible
            value={barcodeValue}
            onChange={(next) => setValue('barcode', next, { shouldValidate: true })}
            error={errors.barcode?.message}
            disabled={isLoading}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              error={errors.category?.message}
              disabled={isLoading}
              required
              {...register('category')}
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </Select>

            <Select
              label="Storage Location"
              error={errors.location?.message}
              disabled={isLoading}
              {...register('location')}
            >
              <option value="">Select location</option>
              <option value="fridge">Fridge</option>
              <option value="freezer">Freezer</option>
              <option value="pantry">Pantry</option>
              <option value="counter">Counter</option>
              <option value="cabinet">Cabinet</option>
            </Select>
          </div>
        </div>

        {/* Quantity Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold tracking-wide text-gray-900 uppercase">Quantity</h3>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              placeholder="2.5"
              error={errors.quantity?.message}
              disabled={isLoading}
              required
              {...register('quantity', { valueAsNumber: true })}
            />

            <Select
              label="Unit"
              error={errors.unit?.message}
              disabled={isLoading}
              required
              {...register('unit')}
            >
              <option value="">Select</option>
              {units.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Dates Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold tracking-wide text-gray-900 uppercase">
            Dates (Optional)
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Input
                label="Purchase Date"
                type="date"
                error={errors.purchaseDate?.message}
                disabled={isLoading}
                {...register('purchaseDate')}
              />
              <p className="mt-1 text-sm text-gray-500">When did you buy this?</p>
            </div>

            <div>
              <Input
                label="Expiry Date"
                type="date"
                error={errors.expiryDate?.message}
                disabled={isLoading}
                {...register('expiryDate')}
              />
              <p className="mt-1 text-sm text-gray-500">When does it expire?</p>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold tracking-wide text-gray-900 uppercase">
            Additional Notes (Optional)
          </h3>

          <div>
            <textarea
              placeholder="Add any extra details about this item..."
              rows={3}
              disabled={isLoading}
              className="focus:border-primary-500 focus:ring-primary-500/20 flex w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 lg:text-sm"
              {...register('notes')}
            />
            {errors.notes && <p className="mt-1 text-sm text-red-500">{errors.notes.message}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="pb-safe flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" fullWidth loading={isLoading} disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add Item'}
          </Button>
        </div>

        {(scanAttribution ?? attribution) && (
          <FoodDataAttribution attribution={(scanAttribution ?? attribution) as FoodAttribution} />
        )}
      </form>
      {/* Nested in the modal's React tree (outside the form) so Radix does not treat
          the scan sheet as an outside interaction and dismiss this modal. */}
      {enableScan && (
        <ScanSheet
          isOpen={scanOpen}
          mode="lookup"
          onClose={() => setScanOpen(false)}
          onResolved={handleScanResolved}
          onAddWithoutBarcode={() => undefined}
        />
      )}
    </Modal>
  );
}
