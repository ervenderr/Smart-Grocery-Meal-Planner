'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeleteAccountSheet } from './delete-account-sheet';

export function DangerZoneCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Card className="border-2 border-red-200 p-6">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900">Delete account</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Permanently remove your account and all your data.
        </p>
        <Button
          type="button"
          variant="danger"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => setIsOpen(true)}
        >
          Delete account
        </Button>
      </Card>
      <DeleteAccountSheet isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
