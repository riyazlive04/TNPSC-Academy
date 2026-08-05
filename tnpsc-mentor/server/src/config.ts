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
 * Whether a browser Origin is allowed. Entries in CORS_ORIGIN are normally exact
 * (`https://app.tnpscmentors.in`) but may also contain a `*` wildcard within a
 * single DNS label (e.g. `https://*.tnpscmentors.in`). Requests with no Origin
 * (curl, health checks, same-origin) are always allowed.
 */
export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true
  return corsOrigins.some((pattern) => {
    if (pattern === origin) return true
    if (!pattern.includes('*')) return false
    // A `*` matches within a SINGLE DNS label only ([^.]*), never across dots,
    // so a wildcard entry (`https://*.tnpscmentors.in`) can't be widened by an
    // attacker subdomain on a different parent (a greedy `.*` previously let
    // `evil.example.com` through).
    const re = new RegExp(
      '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[^.]*') + '$'
    )
    return re.test(origin)
  })
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // Drives refresh-token cookie security: in production (the VPS, served over
  // HTTPS) the cookie is Secure + SameSite=None so it survives the landing
  // page's cross-origin call to the app subdomain; in dev it's plain http on
  // same-site localhost, so SameSite=Lax without Secure.
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
  // ─── AiSensy — WhatsApp signup OTP (optional) ────────────────────────────────
  // Official WhatsApp Business API platform (aisensy.com) used to send the
  // one-time code that verifies phone OWNERSHIP at signup, through a
  // Meta-approved Authentication template wired to an AiSensy "API campaign".
  // Unlike MSG91, AiSensy only delivers messages — this server generates,
  // stores (hashed) and verifies the code itself (see lib/whatsappOtp.ts).
  // When either of these is blank the /register/otp endpoints return 503 and
  // /register works exactly as before (no phone verification required).
  aisensyApiKey: process.env.AISENSY_API_KEY ?? '',
  aisensyCampaignName: process.env.AISENSY_CAMPAIGN_NAME ?? '',
  // ─── Telegram bot — signup phone verification fallback (optional) ───────────
  // For numbers with no WhatsApp: the user opens this bot via a one-time deep
  // link and shares their Telegram-verified phone number, which must match the
  // number being registered (see lib/telegramVerify.ts). TOKEN comes from
  // BotFather (full "<bot_id>:<secret>" form); USERNAME is the bot's @handle
  // (without '@') used to build the t.me deep link. When either is blank the
  // /api/telegram endpoints return 503 and signup offers WhatsApp only.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramBotUsername: (process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, ''),
  // ─── Telegram channel broadcast — CA magazine PDFs (optional) ──────────────
  // A superadmin posts an approved current-affairs issue to the public channel
  // (see lib/telegramChannel.ts). By default the SAME bot that does signup
  // verification posts, so nothing extra is needed beyond adding it to the
  // channel as an admin with "Post Messages"; set TELEGRAM_CA_BOT_TOKEN only if
  // a separate publishing bot is preferred. The channel itself is normally
  // edited in the superadmin console (app_settings.telegram_ca_channel) — this
  // env var is the fallback for a fresh environment.
  telegramCaBotToken: process.env.TELEGRAM_CA_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  telegramCaChannel: (process.env.TELEGRAM_CA_CHANNEL ?? '').trim(),
  // ─── Security alerting (optional but strongly recommended) ─────────────────
  // Where the detectors in lib/securityAlerts.ts send a page when something
  // looks like an attack or a breach: a failed-sign-in burst, someone probing
  // admin routes, a 5xx spike, or a privileged action on a user's account.
  // Without a chat id the events are still written to audit_log and stderr —
  // they just wait for someone to go looking, which is the gap the Privacy
  // Policy's "without undue delay" promise cannot afford. CHAT_ID is your own
  // numeric Telegram chat (message @userinfobot to get it); the token defaults
  // to the bot already used for signup verification.
  securityAlertBotToken:
    process.env.SECURITY_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  securityAlertChatId: (process.env.SECURITY_ALERT_CHAT_ID ?? '').trim(),
  // ─── In-app purchases (App Store / Google Play) ────────────────────────────
  // The mobile apps cannot bill through Razorpay — Apple 3.1.1 and Play's
  // Payments policy both mandate store billing for digital content. Each store's
  // proof is verified here before any entitlement is written.
  //
  // Apple: the StoreKit 2 signed transaction is checked against Apple's root CA
  // offline, so no App Store Connect API key is needed — only the bundle id, and
  // the numeric app id (App Store Connect → App Information → Apple ID) which
  // Apple requires when verifying Production transactions.
  appleBundleId: process.env.APPLE_BUNDLE_ID ?? 'com.tnpscmentor.app',
  appleAppAppleId: Number(process.env.APPLE_APP_APPLE_ID ?? 0) || undefined,
  // Play: a Google Cloud service account with the "View financial data" +
  // "Manage orders" grant on the Play Console, used to call
  // androidpublisher.purchases.products.get. Paste the JSON key verbatim (or a
  // base64 of it) — it is server-only and never reaches a client.
  googlePlayPackageName: process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.tnpscmentor.app',
  googlePlayServiceAccountJson: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? '',
}

/** True when both Razorpay credentials are present — gates the payment routes. */
export const razorpayEnabled = Boolean(config.razorpayKeyId && config.razorpayKeySecret)

/** True when a Google OAuth Client ID is configured — gates Google sign-in. */
export const googleEnabled = Boolean(config.googleClientId)

/** App Store receipt checking needs only the bundle id, which always has a
 *  default — so iOS IAP verification is always available. */
export const appleIapEnabled = Boolean(config.appleBundleId)

/** Play receipt checking needs the service-account key; without it the Android
 *  IAP route returns 503 rather than trusting an unverified purchase token. */
export const googleIapEnabled = Boolean(
  config.googlePlayServiceAccountJson && config.googlePlayPackageName
)

/** True when VAPID keys are present — gates Web Push (in-app feed works regardless). */
export const pushEnabled = Boolean(config.vapidPublicKey && config.vapidPrivateKey)

/** True when MSG91 OTP credentials are present — gates phone-OTP login. */
export const msg91Enabled = Boolean(config.msg91AuthKey && config.msg91OtpTemplateId)

/** True when AiSensy is fully configured — gates the WhatsApp signup-OTP
 * endpoints AND makes /register require a verified-phone ticket. */
export const whatsappOtpEnabled = Boolean(
  config.aisensyApiKey && config.aisensyCampaignName
)

/** True when the Telegram bot is configured — gates the Telegram fallback for
 * signup phone verification (/api/telegram). */
export const telegramVerifyEnabled = Boolean(
  config.telegramBotToken && config.telegramBotUsername
)

/** True when a bot token exists to post CA issues to the channel. The channel
 * id itself is settings-first, so it is checked at send time, not here. */
export const telegramChannelEnabled = Boolean(config.telegramCaBotToken)
