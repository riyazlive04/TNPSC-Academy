// ─── Native push notifications (APNs / FCM) ─────────────────────────────────
// Web Push does not work inside the app: WKWebView has no Push API at all, and
// the Android WebView's service worker cannot hold a subscription the OS will
// wake. So the installed apps register with the OS push service instead and hand
// the resulting token to our server, which stores it next to the Web Push
// subscriptions and fans out to both (see server/src/notify.ts).
//
// The in-app notification feed is unaffected and keeps working with no
// permission granted at all — this layer is only "reach the device".

import { Capacitor } from '@capacitor/core'
import { api } from './api'

const isNative = Capacitor.isNativePlatform()

/**
 * Native push is OFF unless explicitly switched on at build time.
 *
 * Both platforms deliver through Firebase Cloud Messaging, which needs
 * android/app/google-services.json (and, for iOS, the APNs key uploaded to the
 * same Firebase project). Without those, register() cannot obtain a token — so
 * with the flag off we never call it, and isPushSupported() reports false so the
 * whole notifications UI hides rather than offering a switch that fails.
 *
 * A missing feature is fine. A visibly broken one is what gets a one-star review
 * and a reviewer's attention.
 *
 * To enable: drop in google-services.json, set VITE_NATIVE_PUSH=true, rebuild.
 */
export const NATIVE_PUSH_ENABLED =
  (import.meta.env.VITE_NATIVE_PUSH as string | undefined) === 'true'

/** True only when this build can actually obtain a push token. */
export function nativePushConfigured(): boolean {
  return isNative && NATIVE_PUSH_ENABLED
}

/** 'ios' | 'android' — only meaningful when isNative. */
function platform(): 'ios' | 'android' {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
}

export type NativePushResult = 'registered' | 'denied' | 'unsupported' | 'error'

let listenersBound = false

/**
 * Ask for notification permission and register for a device token.
 *
 * Deliberately NOT called on boot. Apple treats an unprompted permission dialog
 * on first launch as a poor experience, and Play's UX guidance says the same, so
 * this runs from an explicit user action (the Profile toggle / the dashboard
 * nudge) once the user knows what they're agreeing to.
 */
export async function enableNativePush(): Promise<NativePushResult> {
  if (!nativePushConfigured()) return 'unsupported'
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const current = await PushNotifications.checkPermissions()
    let status = current.receive
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      status = (await PushNotifications.requestPermissions()).receive
    }
    if (status !== 'granted') return 'denied'

    bindListeners()

    // Resolves via the `registration` listener bound above.
    await PushNotifications.register()
    return 'registered'
  } catch {
    return 'error'
  }
}

/** Whether the OS currently allows this app to post notifications. */
export async function nativePushGranted(): Promise<boolean> {
  if (!nativePushConfigured()) return false
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const { receive } = await PushNotifications.checkPermissions()
    return receive === 'granted'
  } catch {
    return false
  }
}

/** Forget this device server-side. The OS-level permission is the user's to
 *  revoke in Settings; we simply stop sending. */
export async function disableNativePush(): Promise<void> {
  if (!nativePushConfigured()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.unregister().catch(() => {})
    await api.notifications.unregisterDevice().catch(() => {})
  } catch {
    /* best-effort */
  }
}

/**
 * Bind the plugin's event listeners exactly once per app run.
 *
 * `registration` can fire at any time (including a token rotation days later),
 * so the handler must be installed before register() and must stay installed.
 */
function bindListeners(): void {
  if (listenersBound) return
  listenersBound = true

  void (async () => {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    await PushNotifications.addListener('registration', (token) => {
      // Fire-and-forget: a failed upload just means this device misses pushes
      // until the next launch re-registers it.
      void api.notifications.registerDevice({ token: token.value, platform: platform() })
    })

    await PushNotifications.addListener('registrationError', () => {
      /* No token this run; the in-app feed still works. */
    })

    // Tapping a notification should land on whatever it is about, not just the
    // dashboard. The server puts a relative path in data.url.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = (action.notification?.data as { url?: string } | undefined)?.url
      if (url && url.startsWith('/')) window.location.assign(url)
    })
  })()
}

/**
 * Re-register a device that already granted permission, so a rotated token is
 * refreshed on the server. Safe to call on every launch: it never prompts,
 * because it returns early unless permission is already granted.
 */
export async function refreshNativePushToken(): Promise<void> {
  if (!nativePushConfigured()) return
  if (!(await nativePushGranted())) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    bindListeners()
    await PushNotifications.register()
  } catch {
    /* ignore */
  }
}
