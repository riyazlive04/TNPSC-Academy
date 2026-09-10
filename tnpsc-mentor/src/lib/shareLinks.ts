import { Capacitor } from '@capacitor/core'

/**
 * Shareable deep links into single resources.
 *
 * Same idea as the promotional pay links (MOCK_PACK_BUY_PATHS /
 * RANK_BOOSTER_BUY_PATHS in lib/authRouting): one URL that opens ONE thing,
 * handed out in WhatsApp or a class group. The difference is who builds them —
 * those are typed by hand into an ad, these are generated in the UI from
 * whatever issue or paper the user is looking at, so the path shapes live here
 * rather than being spelled out at each call site.
 *
 * Both are authenticated routes. A recipient who isn't signed in lands on
 * /login and is returned to the exact link afterwards (ProtectedRoute passes
 * the attempted location as `from`, and postAuthDestination honours it), so a
 * shared link never dead-ends on the dashboard.
 */

/**
 * Origin to hand out in a shared link.
 *
 * On the web this is wherever the user already is (tnpscmentors.in or
 * app.tnpscmentors.in — both serve the SPA), so a link never moves someone
 * between hosts mid-session. In the native app it CANNOT be
 * window.location.origin: Capacitor serves the bundled dist from a local
 * origin (https://localhost), which is a dead URL on the recipient's phone.
 *
 * The fallback is the marketing domain rather than app.tnpscmentors.in
 * because the recipient is usually someone who does NOT have the app yet;
 * app.* carries the Android App Link that would open the app directly, but
 * only helps the minority who already installed it, and is the noindex host.
 */
export const SHARE_ORIGIN = Capacitor.isNativePlatform()
  ? 'https://tnpscmentors.in'
  : window.location.origin

/** 'YYYY-MM-DD' — the shape both CA deep links address an issue by. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** True for the date shape the CA routes accept; guards a param before use. */
export function isIsoDate(value: string | undefined | null): value is string {
  return !!value && ISO_DATE_RE.test(value)
}

/** Path (no origin) for one day's Current-Affairs magazine issue. */
export function caMagazinePath(date?: string): string {
  return isIsoDate(date) ? `/ca/magazine/${date}` : '/ca/magazine'
}

/** Path (no origin) for one day's Current-Affairs test. */
export function caTestPath(date?: string): string {
  return isIsoDate(date) ? `/ca/test/${date}` : '/ca/test'
}

/** Full shareable URL for one day's Current-Affairs magazine issue. */
export function caMagazineLink(date?: string): string {
  return `${SHARE_ORIGIN}${caMagazinePath(date)}`
}

/** Full shareable URL for one day's Current-Affairs test. */
export function caTestLink(date?: string): string {
  return `${SHARE_ORIGIN}${caTestPath(date)}`
}

/** What actually happened, so the caller can word its own feedback. */
export type ShareOutcome = 'shared' | 'copied' | 'failed'

/**
 * Hand a link to the OS share sheet when there is one (every phone — this is
 * what puts it into WhatsApp in one tap), otherwise put it on the clipboard.
 *
 * A dismissed share sheet reports 'failed' the same way a real error does —
 * the Web Share API rejects with AbortError on cancel and there is nothing
 * useful to say about it, so callers stay silent on 'failed' rather than
 * telling someone their own cancel went wrong.
 */
export async function shareOrCopy(opts: {
  url: string
  /** Share-sheet title (ignored by some targets). */
  title?: string
  /** Line that precedes the URL in the shared message. */
  text?: string
}): Promise<ShareOutcome> {
  const { url, title, text } = opts
  // canShare is checked, not just share: some desktop browsers expose share()
  // and then reject everything handed to it.
  if (navigator.share && (!navigator.canShare || navigator.canShare({ url }))) {
    try {
      await navigator.share({ url, title, text })
      return 'shared'
    } catch {
      // Cancelled, or the target refused it — fall through to the clipboard so
      // the user still ends up holding the link.
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
