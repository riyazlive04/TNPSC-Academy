-- ============================================================================
-- Google sign-in: profile avatar column
-- ----------------------------------------------------------------------------
-- Adds the optional avatar_url column the /api/auth/google route fills from the
-- Google profile picture on first sign-in. Idempotent — safe to re-run.
-- Run from the server/ dir with:
--   node run-migration.mjs ../supabase/google_avatar.sql
-- ============================================================================

alter table public.profiles add column if not exists avatar_url text;
