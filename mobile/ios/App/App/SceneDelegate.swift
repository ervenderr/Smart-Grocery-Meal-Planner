import UIKit
import Capacitor
import WebKit

#if targetEnvironment(simulator)
/// Store-screenshot support, compiled for the Simulator only (never into a device, TestFlight or
/// App Store build). When the app is launched with KUMAUN_SHOT_* environment variables
/// (`SIMCTL_CHILD_KUMAUN_SHOT_*` on `simctl launch`) it hands them to the web layer as
/// `window.__KUMAUN_SHOT__`. Only the screenshot web build (NEXT_PUBLIC_SHOT=1) reads it.
final class ShotBridgeViewController: CAPBridgeViewController {
    // Runs before the page loads. Capacitor replaces the configuration's content controller after
    // webViewConfiguration(for:), so the script is added to the live web view instead.
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        let env = ProcessInfo.processInfo.environment
        guard let email = env["KUMAUN_SHOT_EMAIL"], let password = env["KUMAUN_SHOT_PASSWORD"] else { return }
        var payload: [String: Any] = ["email": email, "password": password]
        for (key, name) in [("route", "KUMAUN_SHOT_ROUTE"), ("click", "KUMAUN_SHOT_CLICK"), ("delayMs", "KUMAUN_SHOT_DELAY_MS")] {
            if let value = env[name] { payload[key] = value }
        }
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.configuration.userContentController.addUserScript(
            WKUserScript(source: "window.__KUMAUN_SHOT__ = \(json);", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
    }
}
#endif

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        #if targetEnvironment(simulator)
        window?.rootViewController = ShotBridgeViewController()
        #else
        window?.rootViewController = CAPBridgeViewController()
        #endif
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
