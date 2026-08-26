// ─── Android WebView detection + default-browser handoff ─────────────────────
// Shared by GoogleSignInButton (reactive: only escapes when the visitor
// actually taps something Google-related) and any page that wants to escape
// PROACTIVELY at a high-intent moment (e.g. RankBoosterLandingPage's "Enroll
// now" for guests, who are about to need working Google Sign-In on /register).

// Android's WebView appends "; wv)" to its user-agent's platform token — absent
// from real Chrome. Google's own Sign-In SDK refuses to run inside a WebView
// (an anti-phishing measure on Google's side, not something we can bypass), so
// this is worth detecting to route around it instead of failing silently.
export const isAndroidWebView = /; ?wv\)/i.test(navigator.userAgent)

/**
 * Hand a page to Android's normal intent resolution — via the `intent://`
 * scheme with NO `package=` restriction, so the OS decides: the user's
 * default browser if they have one set, a chooser if they don't, or — for
 * app.tnpscmentors.in specifically, which carries an autoVerify App Link
 * (see android/app/src/main/AndroidManifest.xml) — this app itself, if
 * installed, whose Google Sign-In goes through the native plugin and was
 * never subject to the WebView block in the first place. Either outcome is
 * correct; only a bare Chrome-only handoff would have been wrong here.
 *
 * This is the standard way a web page escapes an embedding app's WebView.
 * Most in-app browsers (Instagram, Facebook, Messenger, WhatsApp) honour it;
 * a handful deliberately swallow it to keep the user inside their own app,
 * in which case nothing visible happens.
 *
 * @param path Absolute path (e.g. '/register') to open — defaults to the
 *   current page. Always same-origin; only the path is caller-supplied.
 */
export function openInBrowser(path?: string): void {
  const target = path ? `${window.location.origin}${path}` : window.location.href
  const withoutScheme = target.replace(/^https?:\/\//, '')
  window.location.href = `intent://${withoutScheme}#Intent;scheme=https;end`
}
