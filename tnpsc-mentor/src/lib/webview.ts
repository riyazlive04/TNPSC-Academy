// ─── Android WebView detection + Chrome handoff ───────────────────────────────
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
 * Hand a page to Chrome SPECIFICALLY — via Android's `intent://` scheme with
 * an explicit `package=com.android.chrome`, which launches only that app
 * (never a chooser with other browsers) when it's installed. This is the
 * standard way a web page escapes an embedding app's WebView. Most in-app
 * browsers (Instagram, Facebook, Messenger, WhatsApp) honour it and hand off
 * to Chrome directly; a handful deliberately swallow it to keep the user
 * inside their own app, in which case nothing visible happens.
 *
 * @param path Absolute path (e.g. '/register') to open in Chrome — defaults
 *   to the current page. Always same-origin; only the path is caller-supplied.
 */
export function openInChrome(path?: string): void {
  const target = path ? `${window.location.origin}${path}` : window.location.href
  const withoutScheme = target.replace(/^https?:\/\//, '')
  window.location.href = `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`
}
