// ─── Native screenshot / screen-record blocking ─────────────────────────────
// Bridges to the app-local Android `ScreenSecure` plugin (see
// android/.../ScreenSecurePlugin.java), which toggles the window's FLAG_SECURE.
// While enabled the OS refuses screenshots + screen recording and blanks the
// recent-apps thumbnail. No-ops on the web build, where the OS gives no such
// control (the in-test proctoring engine handles keyboard-shortcut captures).

import { Capacitor, registerPlugin } from '@capacitor/core'

interface ScreenSecurePlugin {
  enable(): Promise<void>
  disable(): Promise<void>
}

const ScreenSecure = registerPlugin<ScreenSecurePlugin>('ScreenSecure')

const isNative = Capacitor.isNativePlatform()

/** Block OS screenshots/recording for the current screen. No-op on the web. */
export async function enableScreenSecure(): Promise<void> {
  if (!isNative) return
  try {
    await ScreenSecure.enable()
  } catch {
    /* plugin missing on an older build - fail open rather than crash */
  }
}

/** Re-allow OS screen capture. No-op on the web. */
export async function disableScreenSecure(): Promise<void> {
  if (!isNative) return
  try {
    await ScreenSecure.disable()
  } catch {
    /* ignore */
  }
}
