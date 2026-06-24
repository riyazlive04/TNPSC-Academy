-- ============================================================================
-- TNPSC Mentors — Full Mock Exams (fixed, named 200-Q papers)
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql + secure.sql + superadmin.sql (needs is_admin()).
-- Adds the `mock` question category, a per-question `mock_set` link, the
-- `mock_exams` catalog (tier + enabled gating), a per-user attempts ledger
-- (2-attempt cap), and the admin write RPC. Idempotent: safe to re-run.
-- ============================================================================

-- ─── 1. Allow category = 'mock' ──────────────────────────────────────────────
-- Recreate the live constraint (pyq/samacheer/current_affairs/aptitude/outer/
-- subject) WITH 'mock' added. Keep every existing value or existing rows break.
alter table public.questions drop constraint if exists questions_category_check;
alter table public.questions add constraint questions_category_check
  check (category in (
    'pyq', 'samacheer', 'current_affairs', 'aptitude', 'outer', 'subject', 'mock'
  ));

-- ─── 2. Link a question row to its exam (1..6) ───────────────────────────────
alter table public.questions add column if not exists mock_set integer;
create index if not exists idx_questions_mock_set
  on public.questions (category, mock_set);
-- This project uses COLUMN-LEVEL select grants on `questions` (to hide answer
-- columns), so a newly added column is NOT readable by `authenticated` by
-- default — and filtering `where mock_set = ...` would be denied. Grant it.
grant select (mock_set) on public.questions to authenticated;

-- ─── 3. Mock-exam catalog ────────────────────────────────────────────────────
create table if not exists public.mock_exams (
  id               text primary key,                 -- 'exam1'..'exam6'
  mock_set         integer not null unique,          -- 1..6 (matches questions.mock_set)
  title            text not null,
  title_ta         text,
  total_questions  integer not null default 200,
  duration_seconds integer not null default 10800,   -- 180 min
  negative_mark    numeric  not null default 0,
  tier             text not null default 'paid' check (tier in ('free', 'paid')),
  enabled          boolean not null default false,
  sort_order       integer not null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Seed the 6 exams (insert-only; re-runs leave existing admin edits untouched).
-- exam1: free + enabled · exam2,3: paid + enabled · exam4,5,6: paid + disabled.
insert into public.mock_exams (id, mock_set, title, title_ta, tier, enabled, sort_order) values
  ('exam1', 1, 'Full Mock Exam 1', 'முழு மாதிரித் தேர்வு 1', 'free', true,  1),
  ('exam2', 2, 'Full Mock Exam 2', 'முழு மாதிரித் தேர்வு 2', 'paid', true,  2),
  ('exam3', 3, 'Full Mock Exam 3', 'முழு மாதிரித் தேர்வு 3', 'paid', true,  3),
  ('exam4', 4, 'Full Mock Exam 4', 'முழு மாதிரித் தேர்வு 4', 'paid', false, 4),
  ('exam5', 5, 'Full Mock Exam 5', 'முழு மாதிரித் தேர்வு 5', 'paid', false, 5),
  ('exam6', 6, 'Full Mock Exam 6', 'முழு மாதிரித் தேர்வு 6', 'paid', false, 6)
on conflict (id) do nothing;

-- ─── 4. Per-user attempts ledger (recorded at submit; caps at 2) ─────────────
create table if not exists public.mock_exam_attempts (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  exam_id      text not null references public.mock_exams(id) on delete cascade,
  session_id   uuid references public.test_sessions(id) on delete set null,
  score        numeric,
  total        integer,
  submitted_at timestamptz not null default now()
);
create index if not exists idx_mock_exam_attempts_user_exam
  on public.mock_exam_attempts (user_id, exam_id);

-- ─── 5. Row-level security ───────────────────────────────────────────────────
-- mock_exams: any authenticated user may READ (the server filters to enabled and
-- applies tier/premium gating; disabled rows are not secret). No client writes —
-- edits flow through the is_admin()-gated admin_set_mock_exam RPC below.
alter table public.mock_exams enable row level security;
drop policy if exists mock_exams_select on public.mock_exams;
create policy mock_exams_select on public.mock_exams
  for select to authenticated using (true);

-- mock_exam_attempts: a user may read and insert only their own rows.
alter table public.mock_exam_attempts enable row level security;
drop policy if exists mock_exam_attempts_select on public.mock_exam_attempts;
create policy mock_exam_attempts_select on public.mock_exam_attempts
  for select to authenticated using (user_id = auth.uid());
drop policy if exists mock_exam_attempts_insert on public.mock_exam_attempts;
create policy mock_exam_attempts_insert on public.mock_exam_attempts
  for insert to authenticated with check (user_id = auth.uid());

-- ─── 6. Admin write RPC (SECURITY DEFINER + is_admin(), like admin_write.sql) ─
-- NULL params leave the corresponding column unchanged, so the client can patch
-- a single field. Returns the updated row.
create or replace function public.admin_set_mock_exam(
  p_id               text,
  p_enabled          boolean default null,
  p_tier             text    default null,
  p_title            text    default null,
  p_duration_seconds integer default null,
  p_negative_mark    numeric default null
)
returns public.mock_exams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mock_exams;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_tier is not null and p_tier not in ('free', 'paid') then
    raise exception 'invalid tier: %', p_tier;
  end if;

  update public.mock_exams set
    enabled          = coalesce(p_enabled, enabled),
    tier             = coalesce(p_tier, tier),
    title            = coalesce(p_title, title),
    duration_seconds = coalesce(p_duration_seconds, duration_seconds),
    negative_mark    = coalesce(p_negative_mark, negative_mark),
    updated_at       = now()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'mock exam % not found', p_id;
  end if;
  return v_row;
end;
$$;

grant execute on function
  public.admin_set_mock_exam(text, boolean, text, text, integer, numeric)
  to authenticated;
