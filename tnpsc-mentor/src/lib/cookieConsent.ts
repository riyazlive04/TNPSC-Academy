// ─── Cookie / tracker consent (website only) ────────────────────────────────
// GTM (which also pulls in Microsoft Clarity) and the Meta Pixel are analytics
// and advertising tools. The visible banner/prompt has been removed by
// product decision; visitors are treated as consented automatically and
// trackers load without asking. index.html exposes window.__loadTrackers(),
// which getConsent()'s auto-accept path below calls on first read.
//
// Not applicable in the apps: they ship with no tracker at all, so this
// module never runs there and there is nothing to consent to.

const KEY = 'tnpsc:cookie-consent'

export type ConsentChoice = 'accepted' | 'rejected' | null

declare global {
  interface Window {
    __loadTrackers?: () => void
    __trackersLoaded?: boolean
  }
}

/**
 * The stored choice. There is no visible prompt any more, so a first-time
 * visitor is auto-accepted here (and trackers are kicked off) rather than
 * asked.
 */
export function getConsent(): ConsentChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'accepted' || v === 'rejected') return v
  } catch {
    // Storage blocked — fall through and auto-accept for this page view
    // without persisting.
  }
  setConsent('accepted')
  return 'accepted'
}

/**
 * Record a choice. Accepting loads the tags immediately so the visitor's
 * current page view is measured; rejecting simply never loads them.
 *
 * Note what rejection does NOT do: it cannot unload a tag from a page where the
 * visitor previously accepted. That only takes effect on the next page load,
 * which is why the caller reloads after a switch from accepted to rejected.
 */
export function setConsent(choice: 'accepted' | 'rejected'): void {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    /* best-effort — the in-memory decision still holds for this page */
  }
  if (choice === 'accepted') window.__loadTrackers?.()
}

/** True once tags are actually running, so "Cookie settings" can show state. */
export function trackersLoaded(): boolean {
  return window.__trackersLoaded === true
}
