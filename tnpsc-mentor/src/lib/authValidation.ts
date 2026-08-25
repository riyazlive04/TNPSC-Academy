import type { StringKey } from './i18n'

/** Pragmatic email shape check (not RFC-perfect, just catches typos). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Classify WHY a rejected email failed isValidEmail — a coarse shape tag,
 * never the value itself, so a real occurrence can be diagnosed (autofill
 * cross-filling the phone number? a stray space from predictive text? an
 * incomplete domain?) without logging anyone's actual input anywhere.
 * Only meaningful to call when isValidEmail(raw) is already false.
 */
export function classifyInvalidEmail(raw: string): string {
  const email = raw.trim()
  if (!email) return 'empty_after_trim'
  if (/^\d{10}$/.test(email.replace(/[\s\-()]/g, ''))) return 'looks_like_phone_number'
  const atCount = (email.match(/@/g) ?? []).length
  if (atCount === 0) return 'no_at_sign'
  if (atCount > 1) return 'multiple_at_signs'
  if (/\s/.test(email)) return 'contains_whitespace'
  const domain = email.split('@')[1] ?? ''
  if (!domain.includes('.')) return 'domain_missing_dot'
  return 'other'
}

/**
 * Map a raw error from the API/network into a friendly, translatable key.
 * Never leak infrastructure text ("API is not configured", fetch failures,
 * stack traces) to end users. Recognised auth messages pass through verbatim;
 * everything that looks like an infra/network failure becomes a generic key.
 */
export function friendlyAuthError(raw: string | null | undefined): {
  key?: StringKey
  text?: string
} {
  if (!raw) return { key: 'errServerUnreachable' }
  const msg = raw.toLowerCase()
  // Concurrent-device limit reached (max 2 devices per account).
  if (msg.includes('device_limit')) return { key: 'errDeviceLimit' }
  // Known-safe auth messages from Supabase/GoTrue - show as-is.
  if (
    msg.includes('invalid login') ||
    msg.includes('invalid credentials') ||
    msg.includes('email not confirmed') ||
    msg.includes('already registered') ||
    msg.includes('user already') ||
    msg.includes('check your email') ||
    msg.includes('password should be') ||
    msg.includes('rate limit')
  ) {
    return { text: raw }
  }
  // Infra / config / network noise → generic friendly message.
  if (
    msg.includes('api is not configured') ||
    msg.includes('vite_api_url') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('econnrefused') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503')
  ) {
    return { key: 'errServerUnreachable' }
  }
  // Unknown but non-infra - surface it (likely a meaningful validation msg).
  return { text: raw }
}

/** Score a password 0-4 for the strength meter. */
export function passwordStrength(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(4, score)
}
