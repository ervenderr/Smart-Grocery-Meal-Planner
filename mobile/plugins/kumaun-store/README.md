# kumaun-store

Thin StoreKit 2 Capacitor 8 plugin (SPM) for the Kumaun Full one-time unlock
(product `app.kitcha.mobile.full`).

Why custom: no third-party account or API keys are needed (no RevenueCat), and the
plugin only returns Apple-signed transaction JWS strings. The backend verifies the
JWS and is the only source of entitlement truth. `@capgo/native-purchases` is a
documented fallback behind the same TypeScript interface.

## JS contract (`registerPlugin('KumaunStore')`)

| Method | Result |
|--------|--------|
| `getProduct({ productId })` | `{ productId, displayName, localizedPrice, price, currencyCode }` (`price` is a string) |
| `purchase({ productId })` | `{ status: 'success', jws, originalTransactionId, transactionId }` or `{ status: 'cancelled' }` or `{ status: 'pending' }` |
| `currentEntitlements({ productId })` | `{ transactions: [{ jws, originalTransactionId, transactionId }] }` (verified, non-revoked only) |
| `sync()` | `{}`; runs `AppStore.sync()`, so call it only from an explicit Restore tap |
| `finish({ transactionId })` | `{}`; call only after the server accepted the JWS |
| `unfinishedTransactions({ productId })` | `{ transactions: [{ jws, originalTransactionId, transactionId }] }` for verified unfinished transactions (revoked included). Finishes nothing: JS finishes only the purchase the server already holds and verifies the rest |
| event `transactionUpdated` | `{ jws, originalTransactionId, transactionId, productId, revoked }` for every verified `Transaction.updates` delivery (started in `load()`, retained until a JS listener attaches). JS verifies it with the server, then finishes it |

Reject codes: `INVALID_ARGUMENT`, `PRODUCT_NOT_FOUND`, `UNVERIFIED`, `PURCHASE_FAILED`,
`SYNC_FAILED`, `SYNC_CANCELLED`.

`purchase` never finishes the transaction and sets no `appAccountToken`.

## Registration

Done in plan 12-15: `npm install ./plugins/kumaun-store` then `npx cap sync ios` from
`mobile/`. Capacitor discovers the package through the `capacitor` key in `package.json`
and writes it into `CapApp-SPM/Package.swift`; no `project.pbxproj` edit is needed.

## Build check

```
xcodebuild -scheme KumaunStore -destination generic/platform=iOS build -quiet CODE_SIGNING_ALLOWED=NO
```
