'use client';

import { useSearchParams } from 'next/navigation';

export function DeletedAccountNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get('deleted') !== '1') return null;

  return (
    <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
      Your account has been deleted.
    </p>
  );
}
