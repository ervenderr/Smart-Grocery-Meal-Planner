/**
 * All user-facing Kumaun Full strings (UI-SPEC copywriting contract). No prices live here.
 * The free pantry limit is server-configurable (FREE_PANTRY_LIMIT), so strings that
 * mention it take the limit from /entitlements/me or the 403 details (WR-05).
 */
export const ENTITLEMENT_COPY = {
  cardTitle: 'Kumaun Full',
  chipFree: (limit: number): string => `Free: ${limit} pantry items`,
  chipUnlocked: 'Unlocked',
  descFree:
    'Keep everything you have. Unlock unlimited pantry items and more AI recipe ideas every day with a single purchase.',
  descUnlocked: 'Thank you. Unlimited pantry items and more AI ideas are on for this account.',
  descRevoked: 'Kumaun Full is no longer active on this account.',
  oneTime: 'One-time purchase. No subscription.',
  ctaCard: 'Unlock Kumaun Full',
  ctaSheet: (price: string): string => `Unlock for ${price}`,
  restore: 'Restore Purchases',
  dismiss: 'Maybe later',
  loadingPrice: 'Loading price',
  sheetLead: (limit: number): string => `You've used all ${limit} free pantry spots.`,
  benefits: [
    'Unlimited pantry items',
    'More AI recipe ideas every day',
    'Pay once. No subscription.',
  ],
  reassurance: 'Scanning, expiry reminders, recipes, meal plans and shopping lists stay free.',
  successTitle: "You're all set",
  successBody: 'Kumaun Full is unlocked. Add as many items as you like.',
  successCta: 'Continue adding',
  productUnavailable: "Kumaun Full isn't available right now. Try again in a moment.",
  priceFailed: "Couldn't load the price. Check your connection and try again.",
  tryAgain: 'Try again',
  purchaseFailed: "The purchase didn't go through. You haven't been charged. Try again.",
  verifyFailed: "We couldn't confirm your purchase yet. Tap Restore Purchases to try again.",
  verifyPending: "Purchase received. We'll finish unlocking when you're back online.",
  restoreFailed: "Couldn't restore purchases. Check your connection and try again.",
  restoreSuccess: 'Purchase restored. Kumaun Full is unlocked.',
  restoreNone: 'No previous purchase found for this Apple Account.',
  purchaseRevoked:
    'This purchase was refunded or revoked, so Kumaun Full is not active. Contact support if you were charged.',
  claimedElsewhere:
    'This purchase is already linked to another Kumaun account. Sign in to that account to use it.',
  webNote:
    "Kumaun Full is a one-time unlock in the iOS app. If you've unlocked it, signing in here keeps your unlimited pantry.",
  webLimitInline: (limit: number): string =>
    `Your free pantry is full (${limit} items). Unlock Kumaun Full in the iOS app or remove an item to add more.`,
  finishLimitWeb: (limit: number): string =>
    `Your free pantry is full (${limit} items), so this trip wasn't finished. Remove pantry items, finish without adding to pantry, or unlock Kumaun Full in the iOS app.`,
  deleteAccountNote:
    'Deleting your account removes your Kumaun data and unlock record. Your App Store purchase belongs to your Apple Account and is not refunded or cancelled.',
} as const;
