// ─── Native (Capacitor) Google Sign-In ───────────────────────────────────────
// Inside the Android app the WebView loads from https://localhost, where Google
// Identity Services refuses to run (embedded-webview + unauthorized origin). The
// native plugin runs the real Google account picker and hands back an ID token
// whose audience is our WEB client ID - the exact token shape the server accepts.

import { Capacitor } from '@capacitor/core'

// The WEB OAuth client ID (same value the server verifies). It must be passed to
// the native plugin's `initialize({ clientId })` so the returned ID token's
// audience is this web client, which Supabase already trusts.
const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

/** True only when running inside the packaged Capacitor app (not the web build). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

// The plugin's Android `load()` is empty - it only builds the sign-in client in
// `initialize()`. Calling `signIn()` before that NPEs and crashes the app, so we
// always initialize once first.
let initialized = false

/**
 * Run the native Google account picker and return the ID token, or null if the
 * user cancels. The plugin is imported lazily so the web bundle never pulls in
 * native code paths.
 */
export async function nativeGoogleIdToken(): Promise<string | null> {
  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')
  if (!initialized) {
    await GoogleAuth.initialize({
      clientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email'],
      grantOfflineAccess: false,
    })
    initialized = true
  }
  // Force the account chooser to appear every time. Without this the plugin
  // silently returns the last-used Google account (no picker), which traps a
  // user on an account that's already at the device limit with no way to pick a
  // different one. Signing out of the plugin's cached account first makes
  // signIn() show the chooser. Best-effort - ignore if there's nothing to clear.
  try {
    await GoogleAuth.signOut()
  } catch {
    /* not signed in yet - nothing to clear */
  }
  const user = await GoogleAuth.signIn()
  const idToken = user?.authentication?.idToken
  return idToken ?? null
}
