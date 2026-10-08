'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FoodDataAttribution } from '@/components/food/food-data-attribution';
import { foodApi, type FoodAttribution, type FoodProduct } from '@/lib/api/food';
import { getApiErrorMessage } from '@/lib/api/errors';

const BARCODE_PATTERN = /^\d{8,14}$/;

interface BarcodeLookupProps {
  onFound: (product: FoodProduct) => void;
  disabled?: boolean;
}

export function BarcodeLookup({ onFound, disabled }: BarcodeLookupProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [attribution, setAttribution] = useState<FoodAttribution | null>(null);

  const handleLookup = async () => {
    const trimmed = code.trim();
    if (!BARCODE_PATTERN.test(trimmed)) {
      setMessage('Enter a barcode of 8 to 14 digits.');
      return;
    }

    setLoading(true);
    setMessage(null);
    setProduct(null);
    setAttribution(null);
    try {
      const result = await foodApi.lookupBarcode(trimmed);
      setProduct(result.product);
      setAttribution(result.attribution);
      onFound(result.product);
    } catch (error: unknown) {
      setMessage(getApiErrorMessage(error, 'Lookup failed, try again.'));
    } finally {
      setLoading(false);
    }
  };

  const kcal = product?.nutritionPer100g.energyKcal;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            placeholder="e.g., 5000159484695"
            inputMode="numeric"
            pattern="\d*"
            maxLength={14}
            value={code}
            disabled={disabled || loading}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-label="Barcode number"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0"
          loading={loading}
          disabled={disabled || loading || code.length === 0}
          onClick={handleLookup}
        >
          Look up
        </Button>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}

      {product && (
        <div className="min-w-0 break-words rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <p className="font-medium text-gray-900">{product.name}</p>
          {(product.brand || product.quantity) && (
            <p>{[product.brand, product.quantity].filter(Boolean).join(' - ')}</p>
          )}
          {typeof kcal === 'number' && <p>{kcal} kcal per 100g</p>}
        </div>
      )}

      {attribution && (product || message) && <FoodDataAttribution attribution={attribution} className="break-words" />}
    </div>
  );
}
