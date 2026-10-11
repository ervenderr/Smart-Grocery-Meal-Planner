import XCTest
import StoreKit
import StoreKitTest
@testable import KumaunStorePlugin

/// Probe: can a .storekit configuration be loaded from the command line?
/// Skips (not fails) when StoreKit returns no products on this runtime
/// (Apple Developer Forums thread 826971).
final class StoreKitProbeTests: XCTestCase {
    private static let productId = "app.kitcha.mobile.full"

    private func storekitFileURL() -> URL {
        // .../mobile/plugins/kumaun-store/ios/Tests/KumaunStorePluginTests/<this file>
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<6 { url.deleteLastPathComponent() }
        return url.appendingPathComponent("storekit/Kumaun.storekit")
    }

    func testMappingValidatesProductId() {
        XCTAssertNil(StoreMapping.validatedId(nil))
        XCTAssertNil(StoreMapping.validatedId("   "))
        XCTAssertNil(StoreMapping.validatedId(String(repeating: "a", count: 101)))
        XCTAssertEqual(StoreMapping.validatedId(" app.kitcha.mobile.full "), Self.productId)
    }

    func testStoreKitConfigurationLoadsAndPurchases() async throws {
        let session = try SKTestSession(contentsOf: storekitFileURL())
        session.disableDialogs = true
        session.clearTransactions()

        let products: [Product]
        do {
            products = try await Product.products(for: [Self.productId])
        } catch {
            throw XCTSkip("StoreKit product fetch failed on this runtime: \(error)")
        }
        guard let product = products.first else {
            throw XCTSkip("CLI StoreKit config sync unsupported on this runtime (forum thread 826971)")
        }
        XCTAssertEqual(product.displayName, "Kumaun Full")

        let result = try await product.purchase()
        guard case .success(let verification) = result,
              case .verified = verification else {
            return XCTFail("Expected a verified purchase")
        }
        XCTAssertFalse(verification.jwsRepresentation.isEmpty)
    }
}
