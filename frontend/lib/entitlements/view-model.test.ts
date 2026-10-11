import { describe, expect, it } from 'vitest';
import type { EntitlementMe } from '@/lib/api/entitlements';
import type { StoreProduct } from '@/lib/native/store/store-plugin';
import { ENTITLEMENT_COPY as C } from './copy';
import {
  buildCardModel,
  buildUpgradeSheetModel,
  outcomeMessage,
  type CardInput,
  type SheetInput,
} from './view-model';

const product: StoreProduct = {
  productId: 'p',
  displayName: 'Kumaun Full',
  localizedPrice: '$X',
  price: '1',
  currencyCode: 'USD',
};
const me = (status: EntitlementMe['status']): EntitlementMe => ({
  status,
  productId: 'p',
  environment: null,
  purchasedAt: null,
  revokedAt: null,
  limits: { pantry: 25, aiDaily: 1, aiMonthly: null },
});
const card = (o: Partial<CardInput> = {}): CardInput => ({
  native: true,
  me: me('none'),
  meLoading: false,
  product,
  productError: false,
  flow: 'idle',
  message: null,
  ...o,
});
const sheet = (o: Partial<SheetInput> = {}): SheetInput => ({
  product,
  productError: false,
  flow: 'idle',
  message: null,
  ...o,
});

describe('buildCardModel', () => {
  it('shows the web note off native', () => {
    expect(buildCardModel(card({ native: false })).visible).toBe('web-note');
  });
  it('shows a loading chip while me loads', () => {
    expect(buildCardModel(card({ me: undefined, meLoading: true })).chip).toBe('loading');
  });
  it('unlocked hides buy, ghosts restore and thanks the user', () => {
    const m = buildCardModel(card({ me: me('active') }));
    expect(m).toMatchObject({
      chip: 'unlocked',
      showBuy: false,
      restoreVariant: 'ghost',
      description: C.descUnlocked,
      price: null,
    });
  });
  it('chip text uses the server limit (WR-05)', () => {
    const m = buildCardModel(card({ me: { ...me('none'), limits: { pantry: 40, aiDaily: 1, aiMonthly: null } } }));
    expect(m.chipText).toBe('Free: 40 pantry items');
    expect(buildCardModel(card({ me: me('active') })).chipText).toBe(C.chipUnlocked);
    expect(buildCardModel(card({ me: undefined })).chipText).toBe('Free: 25 pantry items');
  });
  it('sheet lead uses the server limit, default 25 when unknown (WR-05)', () => {
    expect(buildUpgradeSheetModel(sheet({ pantryLimit: 40 })).leadText).toBe("You've used all 40 free pantry spots.");
    expect(buildUpgradeSheetModel(sheet()).leadText).toBe("You've used all 25 free pantry spots.");
  });
  it('revoked reverts to free with the revoked copy', () => {
    const m = buildCardModel(card({ me: me('revoked') }));
    expect(m).toMatchObject({ chip: 'free', description: C.descRevoked, showBuy: true });
  });
  it('shows the StoreKit price and nothing else when loaded', () => {
    expect(buildCardModel(card()).price).toBe('$X');
  });
  it('disables buy without a product', () => {
    const m = buildCardModel(card({ product: undefined }));
    expect(m.price).toBeNull();
    expect(m.buyDisabled).toBe(true);
  });
  it('surfaces productUnavailable on product error', () => {
    const m = buildCardModel(card({ product: null, productError: true }));
    expect(m.message?.text).toBe(C.productUnavailable);
    expect(m.showTryAgain).toBe(true);
  });
  it('disables buy while purchasing', () => {
    expect(buildCardModel(card({ flow: 'purchasing' })).buyDisabled).toBe(true);
  });
  it('hides buy and explains when verification is pending', () => {
    const m = buildCardModel(card({ flow: 'verify-pending' }));
    expect(m.showBuy).toBe(false);
    expect(m.message?.text).toBe(C.verifyPending);
  });
});

describe('buildUpgradeSheetModel', () => {
  it('uses the localized price in the CTA', () => {
    const m = buildUpgradeSheetModel(sheet());
    expect(m.ctaLabel).toBe('Unlock for $X');
    expect(m.buyDisabled).toBe(false);
  });
  it('falls back to a disabled generic CTA while loading', () => {
    const m = buildUpgradeSheetModel(sheet({ product: undefined }));
    expect(m.ctaLabel).toBe('Unlock Kumaun Full');
    expect(m.buyDisabled).toBe(true);
  });
  it('offers try again when the product fails', () => {
    const m = buildUpgradeSheetModel(sheet({ product: null, productError: true }));
    expect(m.priceText).toBeNull();
    expect(m.showTryAgain).toBe(true);
    expect(m.message?.text).toBe(C.priceFailed);
  });
  it('locks secondary actions while purchasing', () => {
    const m = buildUpgradeSheetModel(sheet({ flow: 'purchasing' }));
    expect(m).toMatchObject({ buyLoading: true, secondaryDisabled: true });
  });
  it('hides buy when verify is pending', () => {
    const m = buildUpgradeSheetModel(sheet({ flow: 'verify-pending' }));
    expect(m.showBuy).toBe(false);
    expect(m.message?.text).toBe(C.verifyPending);
  });
  it('switches to the success state', () => {
    expect(buildUpgradeSheetModel(sheet({ flow: 'success' })).state).toBe('success');
  });
});

describe('outcomeMessage', () => {
  it('maps outcomes to copy', () => {
    expect(outcomeMessage({ kind: 'cancelled' })).toBeNull();
    expect(outcomeMessage({ kind: 'unlocked' })).toBeNull();
    expect(outcomeMessage({ kind: 'restored' })?.text).toBe(C.restoreSuccess);
    expect(outcomeMessage({ kind: 'none' })?.text).toBe(C.restoreNone);
    expect(outcomeMessage({ kind: 'failed' })?.text).toBe(C.purchaseFailed);
    expect(outcomeMessage({ kind: 'failed' }, 'restore')?.text).toBe(C.restoreFailed);
    expect(outcomeMessage({ kind: 'verify-failed' })?.text).toBe(C.verifyFailed);
    expect(outcomeMessage({ kind: 'verify-pending' })?.text).toBe(C.verifyPending);
    expect(outcomeMessage({ kind: 'claimed-elsewhere' })?.text).toBe(C.claimedElsewhere);
  });
  it('shows an error for a revoked purchase or restore (WR-06)', () => {
    expect(outcomeMessage({ kind: 'revoked' })).toEqual({ tone: 'error', text: C.purchaseRevoked });
    expect(outcomeMessage({ kind: 'revoked' }, 'restore')).toEqual({ tone: 'error', text: C.purchaseRevoked });
    expect(C.purchaseRevoked).toMatch(/Contact support if you were charged/);
  });
  it('the sheet keeps showing the revoked message after the flow returns to idle', () => {
    const m = buildUpgradeSheetModel(sheet({ flow: 'idle', message: outcomeMessage({ kind: 'revoked' }) }));
    expect(m.message?.text).toBe(C.purchaseRevoked);
    expect(m.state).toBe('offer');
  });
});
