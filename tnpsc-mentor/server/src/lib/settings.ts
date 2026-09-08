import { supabaseAdmin } from '../supabase.js'

// Superadmin-controlled runtime feature flags, stored one row per key in the
// `app_settings` table (value is jsonb). Reads use the service-role client so
// the table can stay locked down (no client RLS policies); writes happen only
// in the superadmin route. Defaults below are the source of truth for shape and
// for what a brand-new environment (no seeded rows) should behave like.

/** Client-facing flags returned by GET /api/app/settings, with defaults. */
export interface PublicSettings {
  /** Show the random-sampled Group Exam mock tab. */
  mock_group_enabled: boolean
  /** Show the Subject / Topic mock tab. */
  mock_subject_enabled: boolean
  /** Show the scheduled Test Series (Group 1 Marathon) nav tab + Test Arena tile. */
  test_series_enabled: boolean
  /** Show the Vettri Nichayam nav tab + Test Arena tile. */
  vettri_enabled: boolean
  /** Show the Group II/IIA Rank Booster nav tab + Test Arena tile. */
  rank_booster_enabled: boolean
  /** Show the flashcard ("Instants") peek on the dashboard. While this is off
   *  the decks are still served to admins, so the feature can be tested on
   *  production before students ever see it. */
  flashcards_enabled: boolean
  /** When true, the app is closed to everyone except admins/superadmins —
   *  every non-exempt API route 503s (see middleware/maintenance.ts) and the
   *  frontend shows a full-screen maintenance page instead of the router. */
  maintenance_mode: boolean

  // ─── Monetisation switches (superadmin "Payments" tab) ─────────────────────
  // These control whether a plan is SOLD — its purchase card, its promo banner,
  // its slot in the landing pricing grid and its forced-paywall pitch — as
  // distinct from `vettri_enabled` / `rank_booster_enabled` above, which control
  // whether the product AREA (nav tab, Test Arena tile) exists at all. A plan
  // can be live for the people who already bought it while no longer being
  // offered to anyone new. Every one of these is enforced server-side too:
  // POST /api/payments/order refuses a plan that is not on sale, so hiding a
  // card is a real withdrawal and not just a cosmetic one.

  /** Master switch. Off = NO plan is sold anywhere: every purchase card, promo
   *  banner, landing pricing grid and forced-upsell modal disappears, and the
   *  order route refuses every plan. Defaults ON — "off" is the exception. */
  payments_enabled: boolean
  /** Sell the ₹1,699 / 6-month Premium Prelims Kit. Defaults OFF. */
  premium_sale_enabled: boolean
  /** Sell the ₹899 / ₹499 Vettri Nichayam bundle. */
  vettri_sale_enabled: boolean
  /** Sell the ₹1,249 / 90-day Group II/IIA Rank Booster. */
  rank_booster_sale_enabled: boolean
  /** Sell the ₹399 / 80-day Group 1 Mock Test Pack. */
  mock_pack_sale_enabled: boolean
}

export const PUBLIC_SETTING_DEFAULTS: PublicSettings = {
  mock_group_enabled: false,
  mock_subject_enabled: false,
  test_series_enabled: false,
  vettri_enabled: false,
  rank_booster_enabled: false,
  flashcards_enabled: false,
  maintenance_mode: false,
  // Selling is the normal state, so these default ON and a superadmin turns
  // them OFF — the inverse of the dark-feature flags above. The one exception
  // is Premium, which is withdrawn from sale by default until it is switched
  // back on from the Payments tab.
  payments_enabled: true,
  premium_sale_enabled: false,
  vettri_sale_enabled: true,
  rank_booster_sale_enabled: true,
  mock_pack_sale_enabled: true,
}

// ─── Admin-only settings ─────────────────────────────────────────────────────
// Writable from the superadmin console but NEVER returned by the public
// /api/app/settings endpoint (readPublicSettings picks its keys explicitly).

/**
 * The bilingual message sent to a student when the question they reported is
 * marked RESOLVED (see lib/reportResolved.ts). Fully superadmin-editable so the
 * wording can change without a redeploy. `enabled: false` turns the message off.
 *
 * Bodies/titles may contain the tokens {subject} and {note} — see
 * REPORT_MESSAGE_TOKENS.
 */
export interface ReportResolvedMessage {
  enabled: boolean
  title: string
  body: string
  title_ta: string
  body_ta: string
}

export const REPORT_RESOLVED_MESSAGE_DEFAULT: ReportResolvedMessage = {
  enabled: true,
  title: 'The question you reported has been fixed',
  body: 'Thanks for flagging it. Our team reviewed the question and made the correction. Please keep reporting anything that looks wrong.',
  title_ta: 'நீங்கள் தெரிவித்த வினா சரிசெய்யப்பட்டது',
  body_ta:
    'தவறைச் சுட்டிக்காட்டியதற்கு நன்றி. எங்கள் குழு அந்த வினாவைப் பரிசீலித்துத் திருத்தியுள்ளது. தவறாகத் தோன்றும் எதையும் தொடர்ந்து தெரிவியுங்கள்.',
}

/** Placeholders the superadmin may use in the message copy. */
export const REPORT_MESSAGE_TOKENS = ['subject', 'note'] as const

/**
 * How long a fresh inbound lead may wait before the desk's response timer turns
 * amber, orange and red. Minutes. Editable because a two-agent shift and a
 * ten-agent shift do not have the same idea of "late", and everything else in
 * the CRM taxonomy is already the superadmin's to set.
 */
export interface CrmSla {
  target_mins: number
  warn_mins: number
  breach_mins: number
}

export const CRM_SLA_DEFAULT: CrmSla = { target_mins: 5, warn_mins: 15, breach_mins: 60 }

export const ADMIN_SETTING_DEFAULTS: Record<string, unknown> = {
  report_resolved_message: REPORT_RESOLVED_MESSAGE_DEFAULT,
  crm_sla: CRM_SLA_DEFAULT,
}

/** The SLA thresholds with defaults applied, and ordering repaired: a warn
 *  below target (or a breach below warn) would make the timer skip a band. */
export async function readCrmSla(): Promise<CrmSla> {
  let raw: Record<string, unknown> = {}
  try {
    raw = await readAllSettings()
  } catch {
    return CRM_SLA_DEFAULT
  }
  const v = (raw.crm_sla ?? {}) as Partial<CrmSla>
  const num = (x: unknown, fallback: number) =>
    Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : fallback
  const target = num(v.target_mins, CRM_SLA_DEFAULT.target_mins)
  const warn = Math.max(target + 1, num(v.warn_mins, CRM_SLA_DEFAULT.warn_mins))
  const breach = Math.max(warn + 1, num(v.breach_mins, CRM_SLA_DEFAULT.breach_mins))
  return { target_mins: target, warn_mins: warn, breach_mins: breach }
}

/** Keys the superadmin console is allowed to write (allow-list). */
export const WRITABLE_SETTING_KEYS = [
  ...Object.keys(PUBLIC_SETTING_DEFAULTS),
  ...Object.keys(ADMIN_SETTING_DEFAULTS),
]

/** All settings rows as a raw key→value map (used by the superadmin console). */
export async function readAllSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin.from('app_settings').select('key, value')
  if (error) throw error
  const map: Record<string, unknown> = {}
  for (const r of (data ?? []) as { key: string; value: unknown }[]) map[r.key] = r.value
  return map
}

/** The public flags with defaults applied for any missing/unknown keys. */
export async function readPublicSettings(): Promise<PublicSettings> {
  const raw = await readAllSettings()
  return {
    mock_group_enabled: Boolean(raw.mock_group_enabled ?? PUBLIC_SETTING_DEFAULTS.mock_group_enabled),
    mock_subject_enabled: Boolean(
      raw.mock_subject_enabled ?? PUBLIC_SETTING_DEFAULTS.mock_subject_enabled
    ),
    test_series_enabled: Boolean(
      raw.test_series_enabled ?? PUBLIC_SETTING_DEFAULTS.test_series_enabled
    ),
    vettri_enabled: Boolean(raw.vettri_enabled ?? PUBLIC_SETTING_DEFAULTS.vettri_enabled),
    rank_booster_enabled: Boolean(
      raw.rank_booster_enabled ?? PUBLIC_SETTING_DEFAULTS.rank_booster_enabled
    ),
    flashcards_enabled: Boolean(
      raw.flashcards_enabled ?? PUBLIC_SETTING_DEFAULTS.flashcards_enabled
    ),
    maintenance_mode: Boolean(
      raw.maintenance_mode ?? PUBLIC_SETTING_DEFAULTS.maintenance_mode
    ),
    payments_enabled: Boolean(raw.payments_enabled ?? PUBLIC_SETTING_DEFAULTS.payments_enabled),
    premium_sale_enabled: Boolean(
      raw.premium_sale_enabled ?? PUBLIC_SETTING_DEFAULTS.premium_sale_enabled
    ),
    vettri_sale_enabled: Boolean(
      raw.vettri_sale_enabled ?? PUBLIC_SETTING_DEFAULTS.vettri_sale_enabled
    ),
    rank_booster_sale_enabled: Boolean(
      raw.rank_booster_sale_enabled ?? PUBLIC_SETTING_DEFAULTS.rank_booster_sale_enabled
    ),
    mock_pack_sale_enabled: Boolean(
      raw.mock_pack_sale_enabled ?? PUBLIC_SETTING_DEFAULTS.mock_pack_sale_enabled
    ),
  }
}

/**
 * Which sale flag governs each ledger plan id. Shared by the order route (to
 * refuse a withdrawn plan) and the superadmin console (to label the switches),
 * so the mapping can never drift from `KNOWN_PLANS` in pricing.ts.
 */
export const PLAN_SALE_FLAG: Record<string, keyof PublicSettings> = {
  premium_annual: 'premium_sale_enabled',
  vettri_nichayam: 'vettri_sale_enabled',
  vettri_month: 'vettri_sale_enabled',
  rank_booster_g2: 'rank_booster_sale_enabled',
  group1_mock_pack: 'mock_pack_sale_enabled',
}

/**
 * Whether `plan` may be bought under these settings. The master switch vetoes
 * everything; a plan with no flag of its own — including `null`, the generic
 * contribution path — is governed by the master switch alone. Pure, so the rule
 * can be tested without a database.
 */
export function planOnSale(settings: PublicSettings, plan: string | null | undefined): boolean {
  if (!settings.payments_enabled) return false
  if (!plan) return true
  const flag = PLAN_SALE_FLAG[plan]
  return flag ? Boolean(settings[flag]) : true
}

/**
 * `planOnSale` against the live settings. Called by POST /api/payments/order
 * BEFORE an order is created, so a plan whose card has been hidden cannot be
 * bought anyway by replaying a captured request.
 */
export async function isPlanOnSale(plan: string | null | undefined): Promise<boolean> {
  return planOnSale(await readPublicSettings(), plan)
}

/**
 * Just the maintenance flag, without the round-trip cost of resolving every
 * other public setting. Used by the request-hot `maintenanceGate` middleware
 * (see middleware/maintenance.ts), which calls this behind its own short-TTL
 * cache rather than on every request.
 */
export async function readMaintenanceMode(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'maintenance_mode')
    .maybeSingle()
  if (error) throw error
  const value = (data as { value?: unknown } | null)?.value
  return Boolean(value ?? PUBLIC_SETTING_DEFAULTS.maintenance_mode)
}

/**
 * The report-resolved message with defaults applied per field, so a partially
 * written or malformed row still yields sendable copy. A blank title/body falls
 * back to the default rather than sending an empty notification.
 */
export async function readReportResolvedMessage(): Promise<ReportResolvedMessage> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'report_resolved_message')
    .maybeSingle()
  if (error) throw error
  const raw = (data as { value?: unknown } | null)?.value
  const row = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReportResolvedMessage>
  const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.trim() ? v : fallback
  const d = REPORT_RESOLVED_MESSAGE_DEFAULT
  return {
    // Only an explicit `false` disables it — a missing row means "on".
    enabled: row.enabled !== false,
    title: str(row.title, d.title),
    body: str(row.body, d.body),
    // Tamil may be intentionally blank (English-only send), so don't backfill
    // it from the default when the superadmin cleared it — only when absent.
    title_ta: typeof row.title_ta === 'string' ? row.title_ta : d.title_ta,
    body_ta: typeof row.body_ta === 'string' ? row.body_ta : d.body_ta,
  }
}

/**
 * One setting read as a string, with a fallback for a missing/blank/wrong-typed
 * row. Used for superadmin-owned COPY (the Telegram caption templates, the
 * channel id) — values that never reach the public settings payload.
 */
export async function readSettingString(key: string, fallback = ''): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  const value = (data as { value?: unknown } | null)?.value
  return typeof value === 'string' && value.trim() ? value : fallback
}

/** Upsert one setting (superadmin only). Returns the stored value. */
export async function writeSetting(key: string, value: unknown): Promise<unknown> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select('value')
    .single()
  if (error) throw error
  return (data as { value: unknown }).value
}
