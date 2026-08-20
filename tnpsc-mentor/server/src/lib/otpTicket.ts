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

// ─── Signup phone-verification ticket ────────────────────────────────────────
// Same trick for a DIFFERENT claim: "this 10-digit phone passed a WhatsApp OTP
// just now" — issued by /register/otp/verify, demanded by /register. The signed
// payload carries a `pv` prefix (and a 4th dot-part), so neither ticket kind can
// ever be replayed as the other. 15-minute TTL: enough to finish the signup
// form, short enough that a leaked ticket goes stale fast.

const PHONE_TTL_MS = 15 * 60 * 1000

/** Issue a ticket binding a verified 10-digit phone for the next 15 minutes. */
export function issuePhoneVerifyTicket(tenDigit: string): string {
  const exp = Date.now() + PHONE_TTL_MS
  const payload = `pv.${tenDigit}.${exp}`
  return `${payload}.${sign(payload)}`
}

/** Return the phone iff the ticket is well-formed, unexpired and untampered. */
export function verifyPhoneVerifyTicket(ticket: string): string | null {
  const parts = String(ticket ?? '').split('.')
  if (parts.length !== 4 || parts[0] !== 'pv') return null
  const [, phone, expStr, sig] = parts
  const expected = sign(`pv.${phone}.${expStr}`)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const exp = Number(expStr)
  if (!exp || exp < Date.now()) return null
  return phone
}

// ─── TOTP step-up ticket ──────────────────────────────────────────────────────
// A third claim on the same mechanism: "this user's password/Google check just
// succeeded — a TOTP step-up is the only thing standing between them and a
// session." Issued by /login and /google when the authenticating account is
// admin/superadmin with totp_enabled, redeemed by /totp/step-up. 5-minute TTL:
// enough to open an authenticator app, short enough that a leaked ticket goes
// stale fast. The `tu` prefix (and 4th dot-part) keeps it from ever being
// replayed as either ticket kind above.

const TOTP_TTL_MS = 5 * 60 * 1000

/** Issue a ticket binding a userId who has cleared password/Google but still
 * owes a TOTP code, for the next 5 minutes. */
export function issueTotpStepUpTicket(userId: string): string {
  const exp = Date.now() + TOTP_TTL_MS
  const payload = `tu.${userId}.${exp}`
  return `${payload}.${sign(payload)}`
}

/** Return the userId iff the ticket is well-formed, unexpired and untampered. */
export function verifyTotpStepUpTicket(ticket: string): string | null {
  const parts = String(ticket ?? '').split('.')
  if (parts.length !== 4 || parts[0] !== 'tu') return null
  const [, userId, expStr, sig] = parts
  const expected = sign(`tu.${userId}.${expStr}`)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const exp = Number(expStr)
  if (!exp || exp < Date.now()) return null
  return userId
}
