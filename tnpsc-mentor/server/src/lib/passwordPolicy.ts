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

/** Enforce the password floor: minimum length, then a best-effort known-breach
 * check. Never rejects solely because HIBP itself was unreachable. */
export async function checkPassword(password: string): Promise<PasswordCheck> {
  if (password.length < MIN_LENGTH) return { ok: false, code: 'too_short' }
  const breached = await isBreached(password)
  if (breached) return { ok: false, code: 'breached' }
  return { ok: true }
}
