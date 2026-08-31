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
}

export const PUBLIC_SETTING_DEFAULTS: PublicSettings = {
  mock_group_enabled: false,
  mock_subject_enabled: false,
  test_series_enabled: false,
  vettri_enabled: false,
  rank_booster_enabled: false,
  flashcards_enabled: false,
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

export const ADMIN_SETTING_DEFAULTS: Record<string, unknown> = {
  report_resolved_message: REPORT_RESOLVED_MESSAGE_DEFAULT,
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
  }
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
