// ─── Where the redirect-mode Checkout sends the buyer next ───────────────────
// POST /api/payments/callback answers a browser NAVIGATION, not a fetch, so
// every outcome is a 303 back into the SPA. The SPA is served on both
// tnpscmentors.in and app.tnpscmentors.in and each keeps its own session, so
// the buyer has to land on the origin they paid from — which the client names
// in the callback_url. Those two query params are attacker-controlled, hence
// the allowlisting here: an unchecked origin would make this an open redirect.

/** Ledger plan id → the `?plan=` key PaymentSuccessPage understands. The in-page
 *  flow's cards navigate with these same keys. */
export const SUCCESS_PLAN_KEY: Record<string, string> = {
  premium_annual: 'premium',
  vettri_nichayam: 'vettri_full',
  vettri_month: 'vettri_month',
  rank_booster_g2: 'rank_booster_g2',
  group1_mock_pack: 'group1_mock_pack',
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

/**
 * The origin to send the buyer back to: the client-named one when it is a bare
 * http(s) origin on the CORS allowlist, otherwise `fallback` (the app's own).
 * Plain http is accepted for localhost only, i.e. dev.
 */
export function safeReturnOrigin(
  raw: unknown,
  isAllowed: (origin: string) => boolean,
  fallback: string
): string {
  if (typeof raw !== 'string' || !raw) return fallback
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return fallback
  }
  const scheme = url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
  // `url.origin === raw` rejects anything carrying a path, query, credentials
  // or trailing slash — only a bare origin is a legitimate value here.
  if (!scheme || url.origin !== raw || !isAllowed(raw)) return fallback
  return raw
}

/** A same-origin path to return a failed buyer to, or '/' when it isn't one. */
export function safeReturnPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 200) return '/'
  // '//host' and '/\host' are protocol-relative to a browser, i.e. off-site.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return '/'
  }
  return raw
}

/** /payment-success, carrying what the page needs to report the conversion
 *  that the in-page handler would otherwise have reported. */
export function successUrl(origin: string, plan: unknown, paymentId: string, amountPaise: number): string {
  const url = new URL('/payment-success', origin)
  const key = typeof plan === 'string' ? SUCCESS_PLAN_KEY[plan] : undefined
  if (key) url.searchParams.set('plan', key)
  url.searchParams.set('pid', paymentId)
  url.searchParams.set('amt', String(amountPaise / 100))
  return url.toString()
}

/**
 * Why a redirect-flow payment did not end on /payment-success, as the SPA's
 * PaymentReturnNotice reads it from `?payment=`:
 *   failed      Razorpay reported the payment failed — try again.
 *   unverified  we refused it (bad signature, wrong amount, not captured).
 *   pending     money may have moved but we could not confirm it yet — do NOT
 *               pay again, contact support.
 */
export type ReturnReason = 'failed' | 'unverified' | 'pending'

/** Back to the page the buyer paid from, flagged so the SPA can say why. */
export function failureUrl(origin: string, path: string, reason: ReturnReason): string {
  const url = new URL(path, origin)
  // Belt and braces: safeReturnPath already refuses anything that could leave.
  const safe = url.origin === origin ? url : new URL('/', origin)
  safe.searchParams.set('payment', reason)
  return safe.toString()
}
