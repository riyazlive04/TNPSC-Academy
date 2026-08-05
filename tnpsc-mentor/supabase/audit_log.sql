-- ============================================================================
-- TNPSC Mentors — audit + security event log
-- ----------------------------------------------------------------------------
-- WHY THIS EXISTS: the Privacy Policy (§10) promises the Data Protection Board
-- of India will be told about a personal-data breach without undue delay. That
-- promise is only keepable if we can DETECT one. Before this table there was no
-- record anywhere of who read or changed a user's data:
--
--   • no request log            → a bulk read of profiles left no trace
--   • no admin action trail     → the superadmin console could list every user,
--                                 grant plans and read feedback, unlogged
--   • auth.audit_log_entries    → empty (0 rows); GoTrue's own trail is not
--                                 retained in this project
--
-- So this is the evidence trail a breach investigation (and the Board's 72-hour
-- report) is built from. It is written ONLY by the server's service-role client
-- — there is deliberately no insert policy, so nothing a user or admin does in
-- the browser can forge or delete an entry.
--
-- Categories:
--   admin    — an admin/superadmin touched the admin or superadmin API
--   auth     — sign-in, sign-up, sign-out, device-limit block, failed password
--   security — a detector fired (auth-failure burst, 403 probing, 5xx spike)
--   data     — a bulk/sensitive data operation (export, deletion, role change)
--
-- Idempotent / re-runnable. Run AFTER schema.sql.
-- ============================================================================

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  category    text not null check (category in ('admin', 'auth', 'security', 'data')),
  -- Machine-readable event name: 'GET /api/superadmin/users', 'login_failed',
  -- 'auth_failure_burst'. Keep it stable — alerts and queries match on it.
  action      text not null,
  -- WHO did it. ON DELETE SET NULL, never CASCADE: deleting an account (or a
  -- rogue admin deleting their own) must not erase the trail of what they did.
  actor_id    uuid references auth.users(id) on delete set null,
  actor_role  text,
  -- WHOSE data was touched, when the request identifies a specific user. Also
  -- SET NULL on delete, for the same reason.
  subject_id  uuid references auth.users(id) on delete set null,
  status      integer,
  ip          text,
  user_agent  text,
  -- Route params + a redacted body/query. Secrets are stripped server-side
  -- (see server/src/lib/audit.ts) — nothing here should ever hold a password,
  -- token, OTP or payment signature.
  detail      jsonb not null default '{}'::jsonb
);

-- Investigation queries are always "recently", "by this actor", "about this
-- user", or "of this kind" — one index each, newest-first.
create index if not exists idx_audit_log_at on public.audit_log (at desc);
create index if not exists idx_audit_log_actor on public.audit_log (actor_id, at desc);
create index if not exists idx_audit_log_subject on public.audit_log (subject_id, at desc);
create index if not exists idx_audit_log_category on public.audit_log (category, at desc);
create index if not exists idx_audit_log_action on public.audit_log (action, at desc);

alter table public.audit_log enable row level security;

-- Superadmins may READ the trail. Nobody may write it through PostgREST: the
-- only writer is the API server's service-role client, which bypasses RLS.
drop policy if exists "superadmin read audit_log" on public.audit_log;
create policy "superadmin read audit_log"
  on public.audit_log for select to authenticated
  using (public.is_superadmin());

grant select on public.audit_log to authenticated;

-- ── Retention ───────────────────────────────────────────────────────────────
-- The Privacy Policy commits to "up to 90 days" for technical and security
-- logs, so the noisy categories are pruned at 90 days. The admin/data trail is
-- kept for 400 days: it is the accountability record a regulator asks for after
-- an incident, and a 90-day window would routinely have expired before a breach
-- is even discovered. Both numbers are stated in the policy — change them
-- together, never just one.
create or replace function public.prune_audit_log()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.audit_log
   where (category in ('auth', 'security') and at < now() - interval '90 days')
      or (category in ('admin', 'data')    and at < now() - interval '400 days');
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_audit_log() from public, anon, authenticated;
