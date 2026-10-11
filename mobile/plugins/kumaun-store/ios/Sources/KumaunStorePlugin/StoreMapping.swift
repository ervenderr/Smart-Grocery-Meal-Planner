import Foundation
import StoreKit

/// Error codes surfaced to JS via call.reject(message, code).
enum StoreErrorCode {
    static let invalidArgument = "INVALID_ARGUMENT"
    static let productNotFound = "PRODUCT_NOT_FOUND"
    static let unverified = "UNVERIFIED"
    static let purchaseFailed = "PURCHASE_FAILED"
    static let syncFailed = "SYNC_FAILED"
    static let syncCancelled = "SYNC_CANCELLED"
}

/// Pure helpers that map StoreKit values to JS-friendly dictionaries.
enum StoreMapping {
    static let maxIdLength = 100

    /// Returns the trimmed string when non-empty and within the length cap.
    static func validatedId(_ raw: String?) -> String? {
        guard let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty,
              value.count <= maxIdLength else { return nil }
        return value
    }

    static func productDictionary(_ product: Product) -> [String: Any] {
        [
            "productId": product.id,
            "displayName": product.displayName,
            "localizedPrice": product.displayPrice,
            // Decimal description keeps the exact value (no float rounding in JSON).
            "price": "\(product.price)",
            "currencyCode": product.priceFormatStyle.currencyCode
        ]
    }

    static func transactionDictionary(jws: String, transaction: Transaction) -> [String: Any] {
        [
            "jws": jws,
            "originalTransactionId": String(transaction.originalID),
            "transactionId": String(transaction.id)
        ]
    }

    static func successDictionary(jws: String, transaction: Transaction) -> [String: Any] {
        var result = transactionDictionary(jws: jws, transaction: transaction)
        result["status"] = "success"
        return result
    }

    /// Only verified, non-revoked transactions for the product are exposed.
    static func isEligible(_ transaction: Transaction, productId: String) -> Bool {
        transaction.productID == productId && transaction.revocationDate == nil
    }
}
