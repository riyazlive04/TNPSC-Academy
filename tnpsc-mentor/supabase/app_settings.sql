-- ============================================================================
-- TNPSC Mentors — App settings (superadmin-controlled feature flags)
-- ----------------------------------------------------------------------------
-- A tiny key→jsonb store for runtime toggles the superadmin flips without a
-- redeploy (e.g. which Mock Test sections are visible). Reads go through the
-- service-role client (server), writes only via the superadmin console. RLS is
-- on with NO client policies, so the browser can't read/write it directly.
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed the Mock Test section toggles. Default HIDDEN (false) — the random-sampled
-- Group Exam and Subject/Topic mocks are off until the superadmin turns them on;
-- the fixed Full Mock Exams tab is always shown. Insert-only so re-runs never
-- clobber a value the superadmin has since changed.
insert into public.app_settings (key, value) values
  ('mock_group_enabled',   'false'::jsonb),
  ('mock_subject_enabled', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
