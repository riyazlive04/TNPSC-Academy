-- ─── Harden profiles RLS: block self-escalation + credit/quota tampering ──────
-- CRITICAL. The live DB still carried the pre-hardening permissive policy
-- ("Users can manage own profile" FOR ALL, no WITH CHECK) together with
-- table-wide UPDATE on every column. So any logged-in user could, with just the
-- public anon key + their own JWT (both ship to every browser), PATCH their own
-- profiles row directly via PostgREST to:
--   • role → 'superadmin'      (full platform takeover)
--   • credits → 999999         (defeat the whole credit gate)
--   • pdf_downloads → 0         (unlimited "free" explanation PDFs)
--   • last_daily_grant → null   (re-farm the daily credit grant)
-- The hardened policy that schema.sql *describes* was never applied here. This
-- migration applies it and adds column-level defence in depth. Idempotent.
--
-- All sensitive columns are mutated ONLY by SECURITY DEFINER RPCs (spend_credits,
-- grant_daily_credit, record_pdf_download, superadmin_set_role, handle_new_user),
-- which run as the table owner and are unaffected by the grants below. The sole
-- authenticated-context writer is routes/profile.ts, which touches exactly the
-- seven columns re-granted at the end.

-- 1. Replace the permissive "manage own" policy with least-privilege split policies.
drop policy if exists "Users can manage own profile" on public.profiles;
drop policy if exists "Users can read own profile"   on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id and role = 'user');

-- Update own row, but role can NEVER change through this path (no self-escalation).
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role is not distinct from (select p.role from public.profiles p where p.id = auth.uid())
  );
-- Note: no DELETE policy → a user can no longer delete their own profile row.

-- 2. Column-level defence in depth: drop table-wide UPDATE, re-grant ONLY the
--    columns the app legitimately lets a user edit (routes/profile.ts `allowed`).
--    Everything else — role, credits, pdf_downloads, last_daily_grant, email, id,
--    created_at, avatar_url — becomes non-updatable by `authenticated`, so even a
--    future policy loosening can't reopen the hole.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, gender, target_group, exam_date, daily_goal, language)
  on public.profiles to authenticated;
