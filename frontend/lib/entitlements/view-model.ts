import type { EntitlementMe } from '@/lib/api/entitlements';
import type { StoreProduct } from '@/lib/native/store/store-plugin';
import type { PurchaseOutcome, RestoreOutcome } from '@/lib/native/store/store-service';
import { ENTITLEMENT_COPY as C } from './copy';
import { freeLimitOf } from './upgrade-error';

export type FlowState = 'idle' | 'purchasing' | 'restoring' | 'success' | 'verify-pending';
export type Message = { tone: 'info' | 'error'; text: string } | null;

export interface CardInput {
  native: boolean;
  me: EntitlementMe | undefined;
  meLoading: boolean;
  product: StoreProduct | null | undefined;
  productError: boolean;
  flow: FlowState;
  message: Message;
}

export interface CardModel {
  visible: 'card' | 'web-note';
  chip: 'loading' | 'free' | 'unlocked';
  chipText: string;
  description: string;
  price: string | null;
  showBuy: boolean;
  buyDisabled: boolean;
  restoreVariant: 'secondary' | 'ghost';
  message: Message;
  showTryAgain: boolean;
}

export interface SheetInput {
  product: StoreProduct | null | undefined;
  productError: boolean;
  flow: FlowState;
  message: Message;
  /** /entitlements/me limits.pantry; the lead copy uses it instead of a fixed 25. */
  pantryLimit?: number | null;
}

export interface UpgradeSheetModel {
  state: 'offer' | 'success';
  leadText: string;
  priceText: string | null;
  ctaLabel: string;
  buyDisabled: boolean;
  buyLoading: boolean;
  secondaryDisabled: boolean;
  showBuy: boolean;
  message: Message;
  showTryAgain: boolean;
}

const PRODUCT_ERROR: Message = { tone: 'error', text: C.productUnavailable };
const PRICE_ERROR: Message = { tone: 'error', text: C.priceFailed };
const PENDING_MESSAGE: Message = { tone: 'info', text: C.verifyPending };

function chipFor(input: CardInput): CardModel['chip'] {
  if (input.me?.status === 'active') return 'unlocked';
  if (!input.me && input.meLoading) return 'loading';
  return 'free';
}

function descriptionFor(chip: CardModel['chip'], me: EntitlementMe | undefined): string {
  if (chip === 'unlocked') return C.descUnlocked;
  return me?.status === 'revoked' ? C.descRevoked : C.descFree;
}

export function buildCardModel(input: CardInput): CardModel {
  const chip = chipFor(input);
  const unlocked = chip === 'unlocked';
  const pending = input.flow === 'verify-pending';
  const busy = input.flow === 'purchasing' || input.flow === 'restoring';
  const price = !unlocked && input.product ? input.product.localizedPrice : null;
  const message =
    input.message ?? (input.productError && !unlocked ? PRODUCT_ERROR : pending ? PENDING_MESSAGE : null);
  return {
    visible: input.native ? 'card' : 'web-note',
    chip,
    chipText: unlocked ? C.chipUnlocked : C.chipFree(freeLimitOf(input.me?.limits.pantry)),
    description: descriptionFor(chip, input.me),
    price,
    showBuy: !unlocked && !pending,
    buyDisabled: !input.product || busy,
    restoreVariant: unlocked ? 'ghost' : 'secondary',
    message,
    showTryAgain: input.productError && !unlocked,
  };
}

export function buildUpgradeSheetModel(input: SheetInput): UpgradeSheetModel {
  const price = input.product?.localizedPrice ?? null;
  const busy = input.flow === 'purchasing' || input.flow === 'restoring';
  const pending = input.flow === 'verify-pending';
  const message =
    input.message ?? (input.productError ? PRICE_ERROR : pending ? PENDING_MESSAGE : null);
  return {
    state: input.flow === 'success' ? 'success' : 'offer',
    leadText: C.sheetLead(freeLimitOf(input.pantryLimit)),
    priceText: price,
    ctaLabel: price ? C.ctaSheet(price) : C.ctaCard,
    buyDisabled: !price || busy,
    buyLoading: input.flow === 'purchasing',
    secondaryDisabled: busy,
    showBuy: !pending,
    message,
    showTryAgain: input.productError,
  };
}

const OUTCOME_TEXT: Record<string, Message> = {
  restored: { tone: 'info', text: C.restoreSuccess },
  none: { tone: 'info', text: C.restoreNone },
  failed: { tone: 'error', text: C.purchaseFailed },
  'verify-failed': { tone: 'error', text: C.verifyFailed },
  'verify-pending': PENDING_MESSAGE,
  'claimed-elsewhere': { tone: 'error', text: C.claimedElsewhere },
};

/** Maps a purchase/restore outcome to inline message copy; cancelled and unlocked show none. */
export function outcomeMessage(
  outcome: PurchaseOutcome | RestoreOutcome,
  source: 'purchase' | 'restore' = 'purchase'
): Message {
  if (outcome.kind === 'failed' && source === 'restore') {
    return { tone: 'error', text: C.restoreFailed };
  }
  return OUTCOME_TEXT[outcome.kind] ?? null;
}
