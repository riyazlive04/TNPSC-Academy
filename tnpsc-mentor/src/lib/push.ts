// ─── Web Push (browser/desktop notifications) ───────────────────────────────
// Registers the service worker, requests notification permission, and exchanges
// a PushManager subscription with the server. The in-app feed works without any
// of this; Web Push is the optional "reach the device" layer on top.

import { api } from './api'

/** Web Push needs a service worker, the Push API, and the Notification API. */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Current OS permission state ('default' until the user is asked). */
export function pushPermission(): NotificationPermission {
  return isPushSupported() ? Notification.permission : 'denied'
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
