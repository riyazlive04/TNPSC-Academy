// ─── Native (Capacitor) Google Sign-In ───────────────────────────────────────
// Inside the native app the WebView loads from https://localhost (Android) or
// capacitor://localhost (iOS), where Google Identity Services refuses to run
// (embedded-webview + unauthorized origin). The native plugin runs the real
// Google account picker and hands back an ID token, which POST /api/auth/google
// forwards to Supabase's signInWithIdToken.
//
// AUDIENCE NOTE — the returned token's `aud` differs per platform:
//   • Android → VITE_GOOGLE_CLIENT_ID (the WEB client id)
//   • iOS     → VITE_GOOGLE_IOS_CLIENT_ID (Google's iOS SDK always signs for the
//               iOS client, regardless of iOSServerClientId)
// BOTH ids must therefore be listed in Supabase → Authentication → Providers →
// Google → "Authorized Client IDs", or iOS sign-in fails with a bare 401. See
// docs/MOBILE_RELEASE.md.

import { Capacitor } from '@capacitor/core'

const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined

/** True only when running inside the packaged Capacitor app (not the web build). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** 'ios' | 'android' | 'web' — drives store-specific copy and IAP routing. */
export function nativePlatform(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform()
  return p === 'ios' || p === 'android' ? p : 'web'
}

// initialize() is idempotent on the plugin side but cheap to guard, and the
// promise is cached so two concurrent sign-in taps can't race two inits.
let initPromise: Promise<void> | null = null

async function ensureInitialized(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    await SocialLogin.initialize({
      google: {
        webClientId: WEB_CLIENT_ID,
        // Only consulted on iOS; harmless on Android.
        iOSClientId: IOS_CLIENT_ID,
        iOSServerClientId: WEB_CLIENT_ID,
        mode: 'online',
      },
    })
  })().catch((e) => {
    initPromise = null // let a later attempt retry a transient failure
    throw e
  })
  return initPromise
}

/**
 * Run the native Google account picker and return the ID token, or null if the
 * user cancels. The plugin is imported lazily so the web bundle never pulls in
 * native code paths.
 */
export async function nativeGoogleIdToken(): Promise<string | null> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  await ensureInitialized()

  // Force the account chooser every time. Without it the picker silently reuses
  // the last-used Google account, trapping a user whose account is already at the
  // 2-device limit with no way to switch. (Capacitor 6 needed a signOut() first;
  // this plugin exposes it as an explicit prompt.)
  // Do NOT pass `scopes`. The plugin already requests openid + userinfo.email +
  // userinfo.profile, which is everything an ID token needs — and passing the
  // option at all switches it to the Authorization API, which requires
  // MainActivity to implement ModifiedMainActivityForSocialLoginPlugin. Without
  // that it rejects outright with "You CANNOT use scopes without modifying the
  // main activity", which is a sign-in that can never succeed.
  //
  // The three flags below are read directly by the Android provider and need no
  // such change; together they suppress the silent one-tap path so the account
  // chooser always appears.
  const res = await SocialLogin.login({
    provider: 'google',
    options: {
      forcePrompt: true,
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
    },
  })

  const result = res?.result as { idToken?: string | null } | undefined
  return result?.idToken ?? null
}

/**
 * Drop the plugin's cached Google session so the next sign-in shows the picker
 * from a clean slate. Called on sign-out; best-effort and never throws.
 */
export async function nativeGoogleSignOut(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    await SocialLogin.logout({ provider: 'google' })
  } catch {
    /* nothing cached, or the plugin was never initialized */
  }
}
