import { useEffect, useState } from 'react'

/**
 * Anti-capture shield for proctored tests.
 *
 * Renders an opaque black overlay whenever the page loses focus or visibility,
 * so the OS app-switcher thumbnail, browser-tab preview and screen-share
 * captures show only a blank screen instead of the question paper. It also
 * intercepts the PrintScreen key on desktop, flashing the shield and wiping the
 * clipboard so the grab is empty.
 *
 * The overlay is intentionally silent - no icon or "capture blocked / recording"
 * text - so the aspirant is never told the screen is being captured/recorded; it
 * simply looks like a blank screen to anyone trying to grab it.
 *
 * Honest limitation: the web platform exposes no equivalent of Android's
 * FLAG_SECURE, so a *foreground* OS screenshot (volume-down + power on a phone)
 * cannot be hard-blocked from a website. This covers every signal the browser
 * does surface - the only complete fix would be shipping a native wrapper.
 */
export default function ScreenGuard(_props: { message?: string }) {
  const [blanked, setBlanked] = useState(false)

  useEffect(() => {
    let revealTimer = 0
    const blank = () => setBlanked(true)
    const reveal = () => setBlanked(false)
    const onVisibility = () => (document.hidden ? blank() : reveal())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        // Best-effort: overwrite whatever the OS just placed on the clipboard.
        navigator.clipboard?.writeText('').catch(() => {})
        blank()
        window.clearTimeout(revealTimer)
        revealTimer = window.setTimeout(reveal, 1200)
      }
    }

    window.addEventListener('blur', blank)
    window.addEventListener('focus', reveal)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('keyup', onKey)
    return () => {
      window.clearTimeout(revealTimer)
      window.removeEventListener('blur', blank)
      window.removeEventListener('focus', reveal)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  if (!blanked) return null
  // Silent, featureless black overlay - no message about capture/recording.
  return <div className="fixed inset-0 z-[70] bg-black" aria-hidden="true" />
}
