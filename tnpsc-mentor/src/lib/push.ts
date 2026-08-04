// ─── Push notifications ─────────────────────────────────────────────────────
// One façade over two transports, so no caller has to know which it is on:
//
//   web    → Web Push. Service worker + PushManager subscription + VAPID.
//   native → APNs/FCM device token (lib/nativePush.ts). WKWebView has no Push
//            API at all and the Android WebView's service worker holds no
//            subscription the OS will wake, so Web Push simply cannot work in
//            the installed apps.
//
// The in-app feed works without any of this; push is the optional "reach the
// device" layer on top.

import { Capacitor } from '@capacitor/core'
import { api } from './api'
import {
  enableNativePush,
  disableNativePush,
  nativePushGranted,
  nativePushConfigured,
} from './nativePush'

const isNative = Capacitor.isNativePlatform()

// The native permission check is async, but pushPermission() is sync and called
// during render. This cache is what bridges that: it is refreshed by the async
// isPushSubscribed()/enablePush() calls the same components already make on
// mount, so by the time the toggle paints its state it is accurate.
let nativePermission: NotificationPermission = 'default'

/** True when this build can deliver push at all. */
export function isPushSupported(): boolean {
  // Native: only when FCM is actually wired up (see nativePush.ts). Reporting
  // false hides the entire notifications section rather than showing a toggle
  // that cannot work.
  if (isNative) return nativePushConfigured()
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Current OS permission state ('default' until the user is asked). */
export function pushPermission(): NotificationPermission {
  if (isNative) return nativePermission
  return isPushSupported() ? Notification.permission : 'denied'
}

/**
 * Is THIS browser currently receiving pushes — i.e. does it hold a live
 * PushManager subscription? Distinct from pushPermission(): a user can have
 * granted permission yet have unsubscribed (disabled) on this device. Drives
 * the Profile enable/disable toggle. Never throws.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (isNative) {
    const granted = await nativePushGranted()
    // Refresh the sync cache pushPermission() reads.
    nativePermission = granted ? 'granted' : nativePermission === 'denied' ? 'denied' : 'default'
    return granted
  }
  if (!isPushSupported()) return false
  try {
    const reg = await registerServiceWorker()
    if (!reg) return false
    return (await reg.pushManager.getSubscription()) != null
  } catch {
    return false
  }
}

// VAPID keys travel as URL-safe base64; PushManager wants an ArrayBuffer-backed
// view. Allocate the ArrayBuffer explicitly so the type is exactly
// Uint8Array<ArrayBuffer> (not the wider ArrayBufferLike the DOM types reject).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

let swReg: ServiceWorkerRegistration | null = null

/** Register the push service worker once; reused across calls. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  if (swReg) return swReg
  try {
    swReg = await navigator.serviceWorker.register('/sw.js')
    return swReg
  } catch {
    return null
  }
}

export type EnablePushResult = 'subscribed' | 'denied' | 'unsupported' | 'unconfigured' | 'error'

/**
 * Full opt-in flow: ask permission → register SW → fetch the VAPID key →
 * subscribe → send the subscription to the server. Idempotent (re-uses an
 * existing subscription). Never throws.
 */
export async function enablePush(): Promise<EnablePushResult> {
  if (isNative) {
    const res = await enableNativePush()
    nativePermission =
      res === 'registered' ? 'granted' : res === 'denied' ? 'denied' : nativePermission
    return res === 'registered' ? 'subscribed' : res === 'denied' ? 'denied' : 'error'
  }
  if (!isPushSupported()) return 'unsupported'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    const reg = await registerServiceWorker()
    if (!reg) return 'error'
    await navigator.serviceWorker.ready

    const key = await api.notifications.vapidKey()
    if (!key) return 'unconfigured'

    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // .buffer (cast to ArrayBuffer) avoids the strict-lib Uint8Array<ArrayBufferLike>
        // vs BufferSource mismatch while passing the exact key bytes.
        applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
      }))

    await api.notifications.subscribe(sub.toJSON())
    return 'subscribed'
  } catch {
    return 'error'
  }
}

/** Tear down the local subscription and tell the server to forget it. */
export async function disablePush(): Promise<void> {
  if (isNative) {
    await disableNativePush()
    return
  }
  try {
    const reg = await registerServiceWorker()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await api.notifications.unsubscribe(sub.endpoint).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
  } catch {
    /* best-effort */
  }
}
