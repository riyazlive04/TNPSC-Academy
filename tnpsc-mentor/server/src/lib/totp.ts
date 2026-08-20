// ─── TOTP two-factor authentication (admin/superadmin) ───────────────────────
// Time-based one-time codes (RFC 6238) as a step-up gate on top of password/
// Google for privileged accounts. otplib does the actual TOTP math; this module
// owns secret generation, QR rendering, and backup-code hashing/verification.
//
// Backup codes are hashed with the same keyed-HMAC pattern already used for
// WhatsApp-OTP codes (lib/whatsappOtp.ts) rather than bcrypt — there's no
// bcrypt dependency in this server today, and a service-key-bound HMAC is
// already this codebase's established way to store a short one-time secret
// without needing deliberate slow-hashing (unlike a user-chosen, reused,
// low-entropy password, a random 10-hex-char backup code is not brute-forceable
// offline even from a fast hash, given the HMAC key itself never leaves the
// server).

// otplib 13 ships a functional (async) API — no more the classic v10-12
// `authenticator` singleton — so every call here is awaited.
import { generateSecret as otpGenerateSecret, generateURI, verify as otpVerify } from 'otplib'
import QRCode from 'qrcode'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

const ISSUER = 'TNPSC Mentors'
const BACKUP_CODE_COUNT = 10

/** A fresh base32 TOTP secret for a new enrollment. */
export function generateSecret(): string {
  return otpGenerateSecret()
}

/** Check a 6-digit code against a stored secret. Never throws — a malformed
 * code (wrong length, non-numeric) just fails to verify. */
export async function verifyToken(secret: string, token: string): Promise<boolean> {
  try {
    const result = await otpVerify({ secret, token })
    return result.valid
  } catch {
    return false
  }
}

/** A scannable QR data-URI for an authenticator app. The secret itself is
 * returned alongside by the caller as a manual-entry fallback. */
export async function enrollmentQr(accountLabel: string, secret: string): Promise<string> {
  const otpauth = generateURI({ issuer: ISSUER, label: accountLabel, secret })
  return QRCode.toDataURL(otpauth)
}

function hashBackupCode(code: string): string {
  return createHmac('sha256', config.supabaseServiceKey).update(code.trim()).digest('base64url')
}

/** Generate a fresh set of one-time backup codes: `plain` is shown to the user
 * exactly once, `hashed` is what actually gets persisted. */
export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () => randomBytes(5).toString('hex'))
  return { plain, hashed: plain.map(hashBackupCode) }
}

/** Check a user-entered backup code against the stored hashes (constant-time).
 * Returns the REMAINING hash list with the matched one removed on success —
 * callers persist this so a spent backup code can never be reused — or null
 * on no match. */
export function consumeBackupCode(input: string, storedHashes: string[]): string[] | null {
  const candidate = Buffer.from(hashBackupCode(input))
  const idx = storedHashes.findIndex((h) => {
    const stored = Buffer.from(h)
    return stored.length === candidate.length && timingSafeEqual(stored, candidate)
  })
  if (idx === -1) return null
  return [...storedHashes.slice(0, idx), ...storedHashes.slice(idx + 1)]
}
