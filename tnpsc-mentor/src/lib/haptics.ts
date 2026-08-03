// ─── Haptic feedback ────────────────────────────────────────────────────────
// Small physical confirmations on the actions that matter in a test: picking an
// answer, submitting, hitting a violation warning. On the web this is a no-op —
// desktop has no haptics, and the Vibration API is unsupported on iOS Safari and
// actively hostile on Android (a buzz where the user expected silence).
//
// Beyond feel, this is part of what separates an app from a bookmarked website
// under Apple guideline 4.2: the app should use the device it is running on.
//
// Every call is fire-and-forget and swallows its own errors. A missing plugin or
// a device with the taptic engine disabled must never break a test.

import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

type Weight = 'light' | 'medium' | 'heavy'

async function impact(weight: Weight): Promise<void> {
  if (!isNative) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const style =
      weight === 'heavy'
        ? ImpactStyle.Heavy
        : weight === 'medium'
          ? ImpactStyle.Medium
          : ImpactStyle.Light
    await Haptics.impact({ style })
  } catch {
    /* no haptics on this device */
  }
}

/** An option was selected / a choice registered. The most common tap in the app. */
export function hapticSelect(): void {
  void impact('light')
}

/** A committing action: submit a test, confirm a purchase, confirm a deletion. */
export function hapticConfirm(): void {
  void impact('medium')
}

/** Something went wrong, or a proctoring violation was recorded. */
export function hapticWarn(): void {
  if (!isNative) return
  void (async () => {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics')
      await Haptics.notification({ type: NotificationType.Warning })
    } catch {
      /* ignore */
    }
  })()
}

/** A test was graded and passed, a badge was earned. */
export function hapticSuccess(): void {
  if (!isNative) return
  void (async () => {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics')
      await Haptics.notification({ type: NotificationType.Success })
    } catch {
      /* ignore */
    }
  })()
}
