interface DietFilterNoticeProps {
  filteredOut?: number;
}

export function DietFilterNotice({ filteredOut }: DietFilterNoticeProps) {
  if (!filteredOut || filteredOut <= 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
      {filteredOut} suggestion{filteredOut === 1 ? '' : 's'} hidden because they conflict with
      your dietary settings. This is a keyword check, not a medical guarantee.
    </div>
  );
}
