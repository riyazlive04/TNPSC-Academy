// ─── MSG91 OTP client ────────────────────────────────────────────────────────
// Thin wrapper over MSG91's v5 OTP API. MSG91 itself generates, stores, expires
// and verifies the code against a DLT-registered template — we only ask it to
// "send to this number" and later "is this the code". No OTP secret ever touches
// our DB. The auth key is server-only (see config.msg91AuthKey).

import { config } from '../config.js'

const BASE = 'https://control.msg91.com/api/v5/otp'

/**
 * Normalise an Indian mobile to its bare 10 digits, stripping an optional +91/91/0
 * prefix plus incidental spaces, hyphens or brackets, and requiring the 6–9 first
 * digit of a real mobile. Returns '' for anything that isn't a valid number, so
 * callers can reject before spending an SMS.
 */
export function normalizeMobile(raw: string): string {
  const cleaned = String(raw ?? '').replace(/[\s\-()]/g, '')
  const m = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/)
  return m ? m[1] : ''
}

/** Full international number MSG91 expects (e.g. 919876543210, no '+'). */
function intlNumber(tenDigit: string): string {
  return `${config.msg91CountryCode}${tenDigit}`
}

interface Msg91Response {
  type?: string
  message?: string
  request_id?: string
}

async function call(
  path: string,
  params: Record<string, string>,
  method: 'GET' | 'POST'
): Promise<Msg91Response> {
  const qs = new URLSearchParams(params).toString()
  try {
    const res = await fetch(`${BASE}${path}?${qs}`, {
      method,
      headers: { authkey: config.msg91AuthKey, 'Content-Type': 'application/json' },
    })
    return (await res.json().catch(() => ({}))) as Msg91Response
  } catch (e) {
    // Network/DNS failure — surface as a non-success so the route returns a clean
    // 502 instead of a 500 stack trace.
    return { type: 'error', message: e instanceof Error ? e.message : 'network error' }
  }
}

/** Ask MSG91 to generate + SMS a 6-digit OTP (10-min expiry) to a 10-digit mobile. */
export async function sendOtp(tenDigit: string): Promise<{ ok: boolean; message?: string }> {
  const params: Record<string, string> = {
    template_id: config.msg91OtpTemplateId,
    mobile: intlNumber(tenDigit),
    otp_length: '6',
    otp_expiry: '10',
  }
  if (config.msg91SenderId) params.sender = config.msg91SenderId
  const data = await call('', params, 'POST')
  return { ok: data.type === 'success', message: data.message }
}

/** Verify a user-entered OTP against MSG91. */
export async function verifyOtp(
  tenDigit: string,
  otp: string
): Promise<{ ok: boolean; message?: string }> {
  const data = await call('/verify', { mobile: intlNumber(tenDigit), otp: String(otp) }, 'GET')
  return { ok: data.type === 'success', message: data.message }
}

/** Resend the OTP over SMS (used by the "Resend code" action). */
export async function retryOtp(tenDigit: string): Promise<{ ok: boolean; message?: string }> {
  const data = await call('/retry', { mobile: intlNumber(tenDigit), retrytype: 'text' }, 'GET')
  return { ok: data.type === 'success', message: data.message }
}
