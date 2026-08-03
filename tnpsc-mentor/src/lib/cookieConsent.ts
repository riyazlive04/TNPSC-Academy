// ─── Cookie / tracker consent (website only) ────────────────────────────────
// GTM (which also pulls in Microsoft Clarity) and the Meta Pixel are analytics
// and advertising tools, not things the service needs to function. Under the
// DPDP Act consent must be free, specific, informed and given by clear
// affirmative action BEFORE processing starts; GDPR says the same for any EU
// visitor. So index.html no longer loads them on page load — it exposes
// window.__loadTrackers(), and only an accepted choice calls it.
//
// Not applicable in the apps: they ship with no tracker at all, so the banner
// never renders there and there is nothing to consent to.

const KEY = 'tnpsc:cookie-consent'

export type ConsentChoice = 'accepted' | 'rejected' | null

declare global {
  interface Window {
    __loadTrackers?: () => void
    __trackersLoaded?: boolean
  }
}

/** The stored choice, or null if the visitor has not answered yet. */
export function getConsent(): ConsentChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'accepted' || v === 'rejected' ? v : null
  } catch {
    // Storage blocked. Treat as unanswered: we ask again rather than assume
    // agreement, which is the safe direction to fail in.
    return null
  }
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
