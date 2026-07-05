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
  /** Show the scheduled Test Series nav tab + Test Arena tile. */
  test_series_enabled: boolean
  /** Show the Vettri Nichayam nav tab + Test Arena tile. */
  vettri_enabled: boolean
}

export const PUBLIC_SETTING_DEFAULTS: PublicSettings = {
  mock_group_enabled: false,
  mock_subject_enabled: false,
  test_series_enabled: false,
  vettri_enabled: false,
}

/** Keys the superadmin console is allowed to write (allow-list). */
export const WRITABLE_SETTING_KEYS = Object.keys(PUBLIC_SETTING_DEFAULTS)

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
  }
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
