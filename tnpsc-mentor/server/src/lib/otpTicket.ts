// ─── OTP login ticket ────────────────────────────────────────────────────────
// A short-lived, server-signed proof that a phone-OTP was JUST verified for a
// given user. It lets the OTP-login device-limit "replace" step complete WITHOUT
// re-sending the (single-use) OTP: the client returns this opaque ticket instead.
// Signed with the service-role key — a secret that never leaves the server — so a
// client cannot forge or tamper with it. Expires after 5 minutes.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

const TTL_MS = 5 * 60 * 1000

function sign(payload: string): string {
  return createHmac('sha256', config.supabaseServiceKey).update(payload).digest('base64url')
}

/** Issue a ticket binding a userId for the next 5 minutes. */
export function issueOtpTicket(userId: string): string {
  const exp = Date.now() + TTL_MS
  const payload = `${userId}.${exp}`
  return `${payload}.${sign(payload)}`
}

/** Return the userId iff the ticket is well-formed, unexpired and untampered. */
export function verifyOtpTicket(ticket: string): string | null {
  const parts = String(ticket ?? '').split('.')
  if (parts.length !== 3) return null
  const [userId, expStr, sig] = parts
  const expected = sign(`${userId}.${expStr}`)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  // Constant-time compare; bail if lengths differ (timingSafeEqual throws on that).
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const exp = Number(expStr)
  if (!exp || exp < Date.now()) return null
  return userId
}
