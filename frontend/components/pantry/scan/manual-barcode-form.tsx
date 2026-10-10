'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidBarcode, normalizeBarcode } from '@/lib/scan/barcode';

const BARCODE_MAX_LENGTH = 14;

interface ManualBarcodeFormProps {
  onSubmit: (barcode: string) => void;
  onAddWithoutBarcode?: () => void;
  /** 06-11 flips this on once the camera is available. */
  cameraAvailable?: boolean;
  onScanWithCamera?: () => void;
  submitLabel?: string;
}

export function ManualBarcodeForm({
  onSubmit,
  onAddWithoutBarcode,
  cameraAvailable = false,
  onScanWithCamera,
  submitLabel = 'Look up barcode',
}: ManualBarcodeFormProps) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const valid = isValidBarcode(value);
  const showError = touched && value.length > 0 && !valid;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (valid) onSubmit(normalizeBarcode(value));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <h2 className="text-xl font-semibold text-gray-900">Type the barcode</h2>
      <div>
        <Input
          label="Barcode"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={BARCODE_MAX_LENGTH}
          placeholder="e.g. 4800016644801"
          value={value}
          aria-invalid={showError || undefined}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          onBlur={() => setTouched(true)}
        />
        <p
          className={`mt-1 text-sm ${showError ? 'text-red-600' : 'text-gray-500'}`}
          role={showError ? 'alert' : undefined}
        >
          {showError ? 'Enter 8 to 14 digits.' : '8 to 14 digits, found under the barcode.'}
        </p>
      </div>
      <Button type="submit" fullWidth disabled={!valid}>
        {submitLabel}
      </Button>
      {cameraAvailable && onScanWithCamera && (
        <Button type="button" variant="outline" fullWidth onClick={onScanWithCamera}>
          <Camera className="h-5 w-5" aria-hidden="true" />
          Scan with camera
        </Button>
      )}
      {onAddWithoutBarcode && (
        <button
          type="button"
          className="min-h-11 w-full text-sm font-semibold text-primary-700 underline"
          onClick={onAddWithoutBarcode}
        >
          Add without a barcode
        </button>
      )}
    </form>
  );
}
