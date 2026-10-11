'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEntitlement } from '@/lib/hooks/use-entitlement';
import { buildUpgradeSheetModel } from '@/lib/entitlements/view-model';
import { closeUpgradeSheet, useUpgradeSheetStore } from '@/lib/entitlements/upgrade-sheet-store';
import { UpgradeSheet } from './upgrade-sheet';

/** Mounted only while open so purchase state resets on every open. */
function OpenUpgradeSheet() {
  const ent = useEntitlement();
  const onUnlocked = useUpgradeSheetStore((s) => s.onUnlocked);
  const [restored, setRestored] = useState(false);
  const retriedRef = useRef(false);
  const success = ent.flow === 'success' || restored;

  useEffect(() => {
    if (!success || retriedRef.current) return;
    retriedRef.current = true;
    onUnlocked?.();
  }, [success, onUnlocked]);

  const handleClose = useCallback(() => {
    const { returnFocus } = useUpgradeSheetStore.getState();
    closeUpgradeSheet();
    returnFocus?.focus();
  }, []);

  const handleRestore = useCallback(async () => {
    const outcome = await ent.restore();
    if (outcome?.kind === 'restored') setRestored(true);
  }, [ent]);

  const baseModel = buildUpgradeSheetModel({
    product: ent.product,
    productError: ent.productError,
    flow: ent.flow,
    message: ent.message,
  });
  const model = success ? { ...baseModel, state: 'success' as const } : baseModel;

  return (
    <UpgradeSheet
      open
      model={model}
      onClose={handleClose}
      onContinue={handleClose}
      onBuy={() => void ent.purchase()}
      onRestore={() => void handleRestore()}
      onRetry={ent.retryProduct}
    />
  );
}

/** Single native-only mount point binding the upgrade store to the sheet. */
export function UpgradeSheetHost() {
  const open = useUpgradeSheetStore((s) => s.open);
  return open ? <OpenUpgradeSheet /> : null;
}
