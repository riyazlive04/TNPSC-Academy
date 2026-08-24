// ─── Password policy ─────────────────────────────────────────────────────────
// The server-side floor for every path that sets a password (register, reset).
// /register previously enforced NO length check server-side at all — only the
// client's form validation stood in the way, trivially bypassed with curl.
//
// The breach check is a HaveIBeenPwned k-anonymity range query: only the first
// 5 hex chars of the password's SHA-1 hash ever leave this server, so the real
// password (or even its full hash) is never sent anywhere, including to HIBP
// itself. Fails OPEN on any network/API error — a third-party outage must never
// block someone from registering or resetting their password.
//
// 2026-08-24: the breach check STOPPED being a hard block. It shipped 2026-08-21
// and coincided with signups collapsing from ~30/day to ~2/day — students commonly
// pick passwords ("Password123!", a phone number, etc.) that look fine by any
// heuristic but ARE in HIBP's corpus, so a large fraction of real registration
// attempts were rejected with no clear path forward (retried the same password,
// kept failing, gave up). The client's strength meter (authValidation.ts) still
// nudges toward a better password; this floor no longer blocks account creation
// over it. Only the length minimum still blocks — that one's cheap, obvious, and
// not what broke signups.

import { createHash } from 'node:crypto'

const MIN_LENGTH = 8
const HIBP_RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range/'

export type PasswordCheck =
  | { ok: true }
  | { ok: false; code: 'too_short' | 'breached' }

/** Query HIBP's k-anonymity range API for a password's SHA-1 suffix. Returns
 * null (never blocks signup/reset) on any network, HTTP or parse failure. */
async function isBreached(password: string): Promise<boolean | null> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  try {
    const res = await fetch(`${HIBP_RANGE_ENDPOINT}${prefix}`, {
      // Padding adds decoy response lines so response SIZE can't be used to
      // infer whether a match was found — a HIBP-supported privacy hardening.
      headers: { 'Add-Padding': 'true' },
    })
    if (!res.ok) return null
    const body = await res.text()
    return body.split('\n').some((line) => line.split(':')[0].trim() === suffix)
  } catch (e) {
    console.error('[password-policy] HIBP lookup failed', e instanceof Error ? e.message : e)
    return null
  }
}

/** Enforce the password floor: minimum length only. The breach check still runs
 * (logged, not blocking) so it stays easy to reinstate as a hard block, or to
 * surface as a non-blocking client-side warning, later. */
export async function checkPassword(password: string): Promise<PasswordCheck> {
  if (password.length < MIN_LENGTH) return { ok: false, code: 'too_short' }
  const breached = await isBreached(password)
  if (breached) console.log('[password-policy] breached password accepted (non-blocking)')
  return { ok: true }
}
