import 'dotenv/config'

/** Read a required env var or fail fast at boot with a clear message. */
function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    // eslint-disable-next-line no-console
    console.error(`[config] Missing required env var: ${name}. See server/.env.example`)
    process.exit(1)
  }
  return v
}

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * Whether a browser Origin is allowed. Entries in CORS_ORIGIN may be exact
 * (`https://app.vercel.app`) or contain `*` wildcards
 * (`https://*-samad-webs-projects.vercel.app` to cover Vercel's per-deploy
 * preview URLs, or `https://*.vercel.app`). Requests with no Origin (curl,
 * health checks, same-origin) are always allowed.
 */
export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true
  return corsOrigins.some((pattern) => {
    if (pattern === origin) return true
    if (!pattern.includes('*')) return false
    // A `*` matches within a SINGLE DNS label only ([^.]*), never across dots.
    // This keeps Vercel preview wildcards working (`https://*-proj.vercel.app`)
    // while preventing a broad `*` from matching an attacker subdomain on a
    // different parent (greedy `.*` previously let `evil.vercel.app` through).
    const re = new RegExp(
      '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[^.]*') + '$'
    )
    return re.test(origin)
  })
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // Drives refresh-token cookie security: in production the cookie is cross-site
  // (Vercel → Render) so it must be Secure + SameSite=None; in dev it's served
  // over http on same-site localhost, so SameSite=Lax without Secure.
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  corsOrigins,
  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  // Razorpay keys are OPTIONAL so the server still boots in environments where
  // payments aren't configured yet. The payment routes check `razorpayEnabled`
  // and return 503 when the keys are absent. KEY_ID is public (sent to the
  // browser to open Checkout); KEY_SECRET is server-only and signs/verifies.
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  // Optional: enables Google sign-in. When unset, POST /api/auth/google returns
  // 503 and the frontend hides the Google button — the rest of auth is
  // unaffected. This same Client ID must ALSO be added to Supabase → Auth →
  // Providers → Google → "Authorized Client IDs" for the ID-token flow to work.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  // Web Push (VAPID). Optional: when unset, the push endpoints return 503 and the
  // app falls back to in-app notifications only. PUBLIC key is shipped to the
  // browser (to subscribe); PRIVATE key is server-only (signs push messages).
  // SUBJECT is a mailto:/https: contact required by the Web Push spec.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:support@sirahdigital.in',
  // ─── MSG91 phone-OTP login (optional) ──────────────────────────────────────
  // Server-side OTP via MSG91's OTP API: the backend asks MSG91 to send + verify
  // the code; MSG91 owns code generation/expiry and the DLT-registered template.
  // When AUTH_KEY or TEMPLATE_ID is unset the OTP endpoints return 503 and the
  // frontend hides the "Sign in with phone" tab. The auth key is server-only.
  msg91AuthKey: process.env.MSG91_AUTH_KEY ?? '',
  msg91OtpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID ?? '',
  // Optional approved DLT sender id; MSG91 falls back to the template's sender
  // when unset.
  msg91SenderId: process.env.MSG91_SENDER_ID ?? '',
  // Country code prefixed to the 10-digit Indian mobile before calling MSG91,
  // which wants the full international number with no leading '+'.
  msg91CountryCode: process.env.MSG91_COUNTRY_CODE ?? '91',
}

/** True when both Razorpay credentials are present — gates the payment routes. */
export const razorpayEnabled = Boolean(config.razorpayKeyId && config.razorpayKeySecret)

/** True when a Google OAuth Client ID is configured — gates Google sign-in. */
export const googleEnabled = Boolean(config.googleClientId)

/** True when VAPID keys are present — gates Web Push (in-app feed works regardless). */
export const pushEnabled = Boolean(config.vapidPublicKey && config.vapidPrivateKey)

/** True when MSG91 OTP credentials are present — gates phone-OTP login. */
export const msg91Enabled = Boolean(config.msg91AuthKey && config.msg91OtpTemplateId)
