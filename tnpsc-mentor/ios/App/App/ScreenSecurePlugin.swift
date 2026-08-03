import Foundation
import UIKit
import Capacitor

/**
 * iOS counterpart of android/.../ScreenSecurePlugin.java.
 *
 * iOS has no FLAG_SECURE — there is no supported way to stop the OS taking a
 * screenshot, and the UITextField-secure-layer trick relies on undocumented view
 * internals that App Review has rejected before. So this does the three things
 * iOS *does* allow, which together cover the same intent:
 *
 *   1. Blanks the app in the multitasking switcher while a test is in progress,
 *      so the questions aren't sitting in a snapshot any passer-by can flick to.
 *   2. Reports screenshots (userDidTakeScreenshotNotification) to the web layer.
 *   3. Reports screen recording / AirPlay mirroring (UIScreen.isCaptured), which
 *      unlike a screenshot IS detectable while it is happening.
 *
 * (2) and (3) surface as `screenCaptured` events that useProctoring records as
 * violations, matching how tab-switching is already treated. Detection rather
 * than prevention, which is the honest ceiling on this platform.
 */
@objc(ScreenSecurePlugin)
public class ScreenSecurePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenSecurePlugin"
    public let jsName = "ScreenSecure"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise)
    ]

    private var privacyOverlay: UIView?
    private var armed = false

    @objc func enable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.armed else { return call.resolve() }
            self.armed = true

            let nc = NotificationCenter.default
            nc.addObserver(self, selector: #selector(self.onScreenshot),
                           name: UIApplication.userDidTakeScreenshotNotification, object: nil)
            nc.addObserver(self, selector: #selector(self.onCaptureChanged),
                           name: UIScreen.capturedDidChangeNotification, object: nil)
            nc.addObserver(self, selector: #selector(self.onWillResign),
                           name: UIApplication.willResignActiveNotification, object: nil)
            nc.addObserver(self, selector: #selector(self.onDidBecomeActive),
                           name: UIApplication.didBecomeActiveNotification, object: nil)

            // A recording that was already rolling when the test started still
            // counts — report it now rather than waiting for a change event that
            // will never come.
            self.onCaptureChanged()
            call.resolve()
        }
    }

    @objc func disable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.armed else { return call.resolve() }
            self.armed = false
            NotificationCenter.default.removeObserver(self)
            self.removeOverlay()
            call.resolve()
        }
    }

    // MARK: - Events

    @objc private func onScreenshot() {
        notifyListeners("screenCaptured", data: ["kind": "screenshot"])
    }

    @objc private func onCaptureChanged() {
        guard UIScreen.main.isCaptured else { return }
        notifyListeners("screenCaptured", data: ["kind": "recording"])
    }

    // MARK: - App-switcher privacy overlay

    @objc private func onWillResign() {
        guard armed, privacyOverlay == nil, let window = keyWindow() else { return }
        let overlay = UIView(frame: window.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = UIColor.systemBackground

        let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
        blur.frame = overlay.bounds
        blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.addSubview(blur)

        window.addSubview(overlay)
        privacyOverlay = overlay
    }

    @objc private func onDidBecomeActive() {
        removeOverlay()
    }

    private func removeOverlay() {
        privacyOverlay?.removeFromSuperview()
        privacyOverlay = nil
    }

    private func keyWindow() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
