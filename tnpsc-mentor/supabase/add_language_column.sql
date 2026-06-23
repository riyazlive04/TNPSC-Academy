-- ============================================================================
-- TNPSC Mentors — add profiles.language
-- ----------------------------------------------------------------------------
-- The app stores the user's UI language preference on the profile so it follows
-- them across devices (see Profile.language / DisplayLang = 'en' | 'ta' | 'both'),
-- but the column was never created. Result: every PATCH /api/profile that sets
-- `language` failed with PostgREST `PGRST204 Could not find the 'language'
-- column`. This adds it (nullable; the app falls back to the local choice when
-- null). Idempotent.
-- ============================================================================

alter table public.profiles add column if not exists language text
  check (language in ('en', 'ta', 'both'));

-- Tell PostgREST (Supabase's REST layer) to refresh its schema cache immediately,
-- so the running API sees the new column without waiting for an auto-reload.
notify pgrst, 'reload schema';
