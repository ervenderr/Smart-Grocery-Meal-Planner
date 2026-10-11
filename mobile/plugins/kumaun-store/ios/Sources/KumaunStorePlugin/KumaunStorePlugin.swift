import Foundation
import Capacitor
import StoreKit

/// Thin StoreKit 2 bridge. The server is the source of truth: this plugin only
/// hands signed transactions (JWS) to JS and never grants entitlement itself.
@objc(KumaunStorePlugin)
public class KumaunStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KumaunStorePlugin"
    public let jsName = "KumaunStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise)
    ]

    private func productId(from call: CAPPluginCall) -> String? {
        let id = StoreMapping.validatedId(call.getString("productId"))
        if id == nil {
            call.reject("productId is required", StoreErrorCode.invalidArgument)
        }
        return id
    }

    private func loadProduct(_ id: String) async throws -> Product? {
        try await Product.products(for: [id]).first
    }

    @objc func getProduct(_ call: CAPPluginCall) {
        guard let id = productId(from: call) else { return }
        Task {
            do {
                guard let product = try await loadProduct(id) else {
                    call.reject("Product not found", StoreErrorCode.productNotFound)
                    return
                }
                call.resolve(StoreMapping.productDictionary(product))
            } catch {
                call.reject("Could not load product", StoreErrorCode.purchaseFailed, error)
            }
        }
    }

    /// Does NOT finish the transaction: JS calls finish() after the server accepted the JWS.
    /// No appAccountToken is set on purpose so restore works after delete + re-signup.
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = productId(from: call) else { return }
        Task {
            do {
                guard let product = try await loadProduct(id) else {
                    call.reject("Product not found", StoreErrorCode.productNotFound)
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        call.resolve(StoreMapping.successDictionary(
                            jws: verification.jwsRepresentation, transaction: transaction))
                    case .unverified:
                        call.reject("Transaction could not be verified", StoreErrorCode.unverified)
                    }
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.reject("Unknown purchase result", StoreErrorCode.purchaseFailed)
                }
            } catch {
                call.reject("Purchase failed", StoreErrorCode.purchaseFailed, error)
            }
        }
    }

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        guard let id = productId(from: call) else { return }
        Task {
            var transactions: [[String: Any]] = []
            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result,
                   StoreMapping.isEligible(transaction, productId: id) {
                    transactions.append(StoreMapping.transactionDictionary(
                        jws: result.jwsRepresentation, transaction: transaction))
                }
            }
            call.resolve(["transactions": transactions])
        }
    }

    /// Prompts for Apple ID sign-in: only reachable from an explicit Restore tap.
    @objc func sync(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve()
            } catch StoreKitError.userCancelled {
                call.reject("Restore cancelled", StoreErrorCode.syncCancelled)
            } catch {
                call.reject("Restore failed", StoreErrorCode.syncFailed, error)
            }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        guard let raw = call.getString("transactionId"),
              let target = UInt64(raw) else {
            call.reject("transactionId is required", StoreErrorCode.invalidArgument)
            return
        }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, transaction.id == target {
                    await transaction.finish()
                    call.resolve()
                    return
                }
            }
            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result, transaction.id == target {
                    await transaction.finish()
                    break
                }
            }
            call.resolve()
        }
    }
}
