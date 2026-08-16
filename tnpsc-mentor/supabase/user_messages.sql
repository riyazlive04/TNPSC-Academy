-- ============================================================================
-- TNPSC Mentors — Superadmin ↔ student direct messaging (two-way thread)
-- ----------------------------------------------------------------------------
-- One thread per student (user_id), shared by every superadmin — a support
-- inbox, not a per-admin private DM. Sits alongside (not replacing) the
-- existing `notifications` broadcast/announcement system: sending a message
-- here ALSO files a `notifyUser()` bell entry deep-linking to /messages, so a
-- reply gets the same push/in-app reach a report-resolved notice does.
--
-- RLS is ON but carries NO policies, matching `notifications` (see
-- notifications.sql): every read/write goes through the Express server using
-- the service-role client, which does its own auth (requireAuth /
-- requireSuperadmin) and applies the `user_id = auth.uid()` / "any user" split
-- there instead of in Postgres policies. No grants to `authenticated` — the
-- REST API has no direct access at all, only the server does.
--
-- Idempotent: safe to re-run. Run with:
--   node run-migration.mjs ../supabase/user_messages.sql
-- ============================================================================

create table if not exists public.user_messages (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  sender           text not null check (sender in ('user', 'admin')),
  -- Who actually typed it: the student themselves (sender='user', always ==
  -- user_id) or the specific superadmin (sender='admin') — kept for
  -- attribution, distinct from user_id which identifies the THREAD.
  sender_id        uuid references auth.users(id) on delete set null,
  body             text not null,
  body_ta          text,
  read_by_user_at  timestamptz,
  read_by_admin_at timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_user_messages_thread
  on public.user_messages (user_id, created_at);

alter table public.user_messages enable row level security;
