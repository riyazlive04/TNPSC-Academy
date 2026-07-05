-- ============================================================================
-- TNPSC Mentors — Free-tier per-topic usage ledger (PYQ + Current Affairs gate)
-- ----------------------------------------------------------------------------
-- Free users may attempt ONE test per topic on PYQ (Group 1 & 2) and Current
-- Affairs; premium OR vettri bundle holders are unlimited. `test_sessions` only
-- stores coarse keys (category/subject/ca_month) — not the pyq2 sub-type or the
-- CA topic — so counting sessions cannot gate at true per-topic granularity.
-- This dedicated ledger records a normalized `gate_key` (derived server-side in
-- lib/freeGate.ts) once per (user, topic) on the first COMPLETED submit. The
-- /quiz gate then blocks the second attempt for non-unlimited users.
--
-- Writes are server-only (service role, bypasses RLS). Reads are the caller's own
-- rows (used by GET /questions/topic-access to render lock pills). Idempotent.
--   node run-migration.mjs ../supabase/free_test_usage.sql
-- ============================================================================

create table if not exists public.free_test_usage (
  user_id       uuid not null references auth.users(id) on delete cascade,
  gate_key      text not null,            -- e.g. 'pyq:Geography', 'ca:m:June 2026'
  first_used_at timestamptz not null default now(),
  primary key (user_id, gate_key)         -- one row per (user, topic); PK is the lookup index
);

-- RLS: a user may READ only their own usage. No client insert/update/delete
-- policies — the ONLY writer is the server (supabaseAdmin, service role) on
-- submit, which bypasses RLS. This keeps the gate un-forgeable from the client.
alter table public.free_test_usage enable row level security;
drop policy if exists free_test_usage_select on public.free_test_usage;
create policy free_test_usage_select on public.free_test_usage
  for select to authenticated using (user_id = auth.uid());
