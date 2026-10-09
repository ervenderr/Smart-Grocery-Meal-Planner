import { PackageX } from 'lucide-react';

export function UsedUpBadge() {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2 py-1 text-sm font-semibold text-gray-700">
      <PackageX className="h-4 w-4" aria-hidden="true" />
      Used up
    </span>
  );
}
