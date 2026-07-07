// ─── WhatsApp signup OTP (AiSensy) ───────────────────────────────────────────
// Sends and verifies the one-time code that proves a user OWNS the mobile
// number they typed at signup. Unlike MSG91 (which owns the whole OTP
// lifecycle), AiSensy is a dumb pipe — a WhatsApp Business API platform
// (aisensy.com) that delivers a Meta-approved Authentication template through
// its "API campaign" endpoint. So THIS module owns code generation, storage
// and verification: codes live in public.phone_otps as an HMAC only
// (service-role access only), expire after 10 minutes, allow 5 wrong guesses,
// and a fresh code can't be re-requested inside a 45 s cooldown.
//
// The message text lives in the approved template, not here — Meta only
// permits OTP content in AUTHENTICATION-category templates, whose body is
// fixed ("<code> is your verification code…" + copy-code button); custom
// wording gets auto-rejected. The template behind AISENSY_CAMPAIGN_NAME must
// take the code as its single body param AND as the copy-code button param.

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'
import { supabaseAdmin } from '../supabase.js'

const OTP_TTL_MIN = 10
const RESEND_COOLDOWN_S = 45
const MAX_ATTEMPTS = 5
// India-only app (every entry point validates a 6-9 leading 10-digit mobile).
const COUNTRY_CODE = '91'

const AISENSY_ENDPOINT = 'https://backend.aisensy.com/campaign/t1/api/v2'

export type SendResult =
  | { ok: true }
  | { ok: false; code: 'cooldown' | 'send_failed' | 'store_failed' }

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

/** Fire the AiSensy API campaign that delivers the code. Never throws —
 * network/DNS failures come back as status 0 so callers surface a clean 502
 * instead of a stack trace. Note "accepted" here means AiSensy queued the
 * message with Meta, not that it reached a handset — a number with no WhatsApp
 * fails silently downstream (there is no pre-send lookup on the official API). */
async function aisensySend(tenDigit: string, code: string): Promise<{ status: number; data: unknown }> {
  try {
    const res = await fetch(AISENSY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: config.aisensyApiKey,
        campaignName: config.aisensyCampaignName,
        destination: `${COUNTRY_CODE}${tenDigit}`,
        // Names the contact inside AiSensy's CRM; no real name exists yet at
        // this point in signup, so the number itself is the honest label.
        userName: tenDigit,
        // Authentication templates want the code twice: once for the body
        // param, once for the copy-code (url-type) button param.
        templateParams: [code],
        buttons: [
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [{ type: 'text', text: code }],
          },
        ],
      }),
    })
    return { status: res.status, data: await res.json().catch(() => ({})) }
  } catch (e) {
    return { status: 0, data: { message: e instanceof Error ? e.message : 'network error' } }
  }
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

  const { status, data } = await aisensySend(tenDigit, code)
  if (status < 200 || status >= 300) {
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
