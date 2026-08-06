-- ============================================================================
-- TNPSC Mentors — backfill profiles rows for orphaned auth accounts
-- ----------------------------------------------------------------------------
-- 2026-08-05. Seven auth.users rows existed with no matching public.profiles
-- row. Every profile-scoped read does `.eq('id', userId).single()`, so PostgREST
-- returned PGRST116 ("Cannot coerce the result to a single JSON object") and the
-- message reached the user's screen as a toast. Affected accounts could not open
-- their profile, could not delete their account, and showed a phantom 0 credits
-- (lib/credits.ts falls back to zero when the lookup errors).
--
-- The rows were NOT removed by the superadmin delete flow — that calls
-- auth.admin.deleteUser, which cascades payments too, yet one affected account
-- still had a paid payment row. Most likely a manual DELETE on profiles at some
-- point. handle_new_user() itself is correct and still attached to auth.users.
--
-- This inserts exactly what handle_new_user() would have inserted; every other
-- column takes its schema default (credits = 50, daily_goal = 20, role = 'user').
-- Additive only — no existing row is updated or deleted. Idempotent: re-running
-- is a no-op once no orphans remain.
--
--   node -r dotenv/config run-migration.mjs ../supabase/backfill_missing_profiles.sql
-- ============================================================================

insert into public.profiles (id, email, full_name, role)
select u.id, u.email, u.raw_user_meta_data->>'full_name', 'user'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
