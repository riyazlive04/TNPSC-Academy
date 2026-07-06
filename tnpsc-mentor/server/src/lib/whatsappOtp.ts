// ─── WhatsApp signup OTP (Evolution API) ─────────────────────────────────────
// Sends and verifies the one-time code that proves a user OWNS the mobile
// number they typed at signup. Unlike MSG91 (which owns the whole OTP
// lifecycle), Evolution API is a dumb pipe — a self-hosted WhatsApp gateway
// (github.com/EvolutionAPI/evolution-api, v2 REST) that delivers plain text
// messages from a QR-paired WhatsApp number. So THIS module owns code
// generation, storage and verification: codes live in public.phone_otps as an
// HMAC only (service-role access only), expire after 10 minutes, allow 5 wrong
// guesses, and a fresh code can't be re-requested inside a 45 s cooldown.

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'
import { supabaseAdmin } from '../supabase.js'

const OTP_TTL_MIN = 10
const RESEND_COOLDOWN_S = 45
const MAX_ATTEMPTS = 5
// India-only app (every entry point validates a 6-9 leading 10-digit mobile).
const COUNTRY_CODE = '91'

export type SendResult =
  | { ok: true }
  | { ok: false; code: 'cooldown' | 'no_whatsapp' | 'send_failed' | 'store_failed' }

export type VerifyResult =
  | { ok: true }
  | { ok: false; code: 'invalid' | 'expired' | 'too_many_attempts' }

/** HMAC the code with the phone bound in, keyed by the server-only service-role
 * key — a stolen hash can neither be reversed nor replayed for another number. */
function hashOtp(tenDigit: string, code: string): string {
  return createHmac('sha256', config.supabaseServiceKey)
    .update(`${tenDigit}.${code}`)
    .digest('base64url')
}

/** POST to the Evolution API instance. Never throws — network/DNS failures come
 * back as status 0 so callers surface a clean 502 instead of a stack trace. */
async function evo(path: string, body: unknown): Promise<{ status: number; data: unknown }> {
  try {
    const res = await fetch(`${config.evolutionApiUrl}${path}`, {
      method: 'POST',
      headers: { apikey: config.evolutionApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, data: await res.json().catch(() => ({})) }
  } catch (e) {
    return { status: 0, data: { message: e instanceof Error ? e.message : 'network error' } }
  }
}

/**
 * Whether the number has a WhatsApp account, per Evolution API's lookup.
 * Returns null when the lookup itself failed — callers should treat that as
 * "unknown" and attempt the send anyway rather than falsely reject a user.
 */
async function isOnWhatsApp(tenDigit: string): Promise<boolean | null> {
  const { status, data } = await evo(
    `/chat/whatsappNumbers/${encodeURIComponent(config.evolutionInstance)}`,
    { numbers: [`${COUNTRY_CODE}${tenDigit}`] }
  )
  if (status !== 200 && status !== 201) return null
  const first = Array.isArray(data) ? (data[0] as { exists?: unknown } | undefined) : undefined
  return typeof first?.exists === 'boolean' ? first.exists : null
}

/** The message the aspirant receives — bilingual, WhatsApp-bold code. */
function otpMessage(code: string): string {
  return (
    `TNPSC Mentor: Your verification code is *${code}*\n\n` +
    `உங்கள் சரிபார்ப்புக் குறியீடு: *${code}*\n\n` +
    `Valid for ${OTP_TTL_MIN} minutes. Do not share this code with anyone.`
  )
}

/**
 * Generate a fresh 6-digit code for a number being registered, persist its hash
 * and deliver it over WhatsApp. Enforces the per-phone resend cooldown (the
 * phone+IP rate limiter on the route is the outer, coarser guard).
 */
export async function sendSignupOtp(tenDigit: string): Promise<SendResult> {
  const { data: existing } = await supabaseAdmin
    .from('phone_otps')
    .select('last_sent_at')
    .eq('phone', tenDigit)
    .maybeSingle()
  if (existing?.last_sent_at) {
    const elapsed = Date.now() - new Date(existing.last_sent_at as string).getTime()
    if (elapsed < RESEND_COOLDOWN_S * 1000) return { ok: false, code: 'cooldown' }
  }

  // Reject numbers with no WhatsApp up front — clearer error for the user and
  // no wasted send. An inconclusive lookup (gateway hiccup) falls through.
  if ((await isOnWhatsApp(tenDigit)) === false) return { ok: false, code: 'no_whatsapp' }

  // Full 000000–999999 range (padded), crypto-grade randomness.
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const { error: upsertErr } = await supabaseAdmin.from('phone_otps').upsert({
    phone: tenDigit,
    otp_hash: hashOtp(tenDigit, code),
    expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
    attempts: 0,
    last_sent_at: new Date().toISOString(),
  })
  if (upsertErr) {
    console.error('[wa-otp] store failed', tenDigit, upsertErr.message)
    return { ok: false, code: 'store_failed' }
  }

  const { status, data } = await evo(
    `/message/sendText/${encodeURIComponent(config.evolutionInstance)}`,
    { number: `${COUNTRY_CODE}${tenDigit}`, text: otpMessage(code) }
  )
  if (status !== 200 && status !== 201) {
    console.error('[wa-otp] send failed', tenDigit, status, JSON.stringify(data).slice(0, 300))
    return { ok: false, code: 'send_failed' }
  }

  // Opportunistic sweep of long-dead rows so the table never accumulates
  // abandoned signups. Best-effort — a failure here must not fail the send.
  void supabaseAdmin
    .from('phone_otps')
    .delete()
    .lt('expires_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString())
    .then(({ error }) => {
      if (error) console.error('[wa-otp] cleanup failed', error.message)
    })

  return { ok: true }
}

/**
 * Check a user-entered code. Single-use: the row is deleted on success, on
 * expiry and once the guess budget is spent — a spent code can never verify.
 */
export async function verifySignupOtp(tenDigit: string, otp: string): Promise<VerifyResult> {
  const { data: row } = await supabaseAdmin
    .from('phone_otps')
    .select('otp_hash, expires_at, attempts')
    .eq('phone', tenDigit)
    .maybeSingle()
  // No pending code (never sent, already used, or swept) reads as expired.
  if (!row) return { ok: false, code: 'expired' }

  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await supabaseAdmin.from('phone_otps').delete().eq('phone', tenDigit)
    return { ok: false, code: 'expired' }
  }
  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    await supabaseAdmin.from('phone_otps').delete().eq('phone', tenDigit)
    return { ok: false, code: 'too_many_attempts' }
  }

  const expected = Buffer.from(row.otp_hash as string)
  const actual = Buffer.from(hashOtp(tenDigit, otp.trim()))
  const match = expected.length === actual.length && timingSafeEqual(expected, actual)
  if (!match) {
    await supabaseAdmin
      .from('phone_otps')
      .update({ attempts: (row.attempts as number) + 1 })
      .eq('phone', tenDigit)
    return { ok: false, code: 'invalid' }
  }

  await supabaseAdmin.from('phone_otps').delete().eq('phone', tenDigit)
  return { ok: true }
}
