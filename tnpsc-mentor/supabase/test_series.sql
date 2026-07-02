-- ============================================================================
-- TNPSC Mentors — Test Series (scheduled Group 1 "Test Marathon 2026" papers)
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql + secure.sql + superadmin.sql + mock_exams.sql (needs
-- is_admin()). Mirrors mock_exams.sql: adds the `testseries` question category,
-- a per-question `test_set` link, the `test_series` catalog (date-gate + admin
-- override; the WHOLE series is premium-only, gated server-side), a per-user
-- attempts ledger (2-attempt cap), and the admin write RPC. Idempotent.
--
-- Apply the two secure.sql leak-guard functions from test_series_leak_guard.sql
-- SEPARATELY (do NOT re-run the whole secure.sql — see that file's header).
-- ============================================================================

-- ─── 1. Allow category = 'testseries' ────────────────────────────────────────
-- Recreate the constraint WITH 'testseries' added. It MUST list every category
-- value that already exists in the live table (verified 2026-07-02: pyq,
-- samacheer, current_affairs, aptitude, outer, subject, mock, pyq2) — adding a
-- constraint that omits any live value fails validation against existing rows.
alter table public.questions drop constraint if exists questions_category_check;
alter table public.questions add constraint questions_category_check
  check (category in (
    'pyq', 'samacheer', 'current_affairs', 'aptitude', 'outer', 'subject',
    'mock', 'pyq2', 'testseries'
  ));

-- ─── 2. Link a question row to its test (1..13) ──────────────────────────────
alter table public.questions add column if not exists test_set integer;
create index if not exists idx_questions_test_set
  on public.questions (category, test_set);
-- COLUMN-LEVEL select grants hide answer columns, so a newly added column is not
-- readable by `authenticated` by default — and a `where test_set = ...` filter
-- would be denied (Postgres 42501, surfaced as a misleading 403). Grant it.
grant select (test_set) on public.questions to authenticated;

-- ─── 3. Test-series catalog ──────────────────────────────────────────────────
create table if not exists public.test_series (
  id                text primary key,               -- 'test1'..'test13'
  test_set          integer not null unique,        -- 1..13 (matches questions.test_set)
  title             text not null,
  title_ta          text,
  unit_label        text,
  unit_label_ta     text,
  subjects_label    text,
  subjects_label_ta text,
  total_questions   integer not null default 100,
  duration_seconds  integer not null default 5400,  -- 90 min (200-Q mocks: 180 min)
  negative_mark     numeric not null default 0,     -- Group 1 prelim: no negative marking
  scheduled_date    date,                           -- unlock date (poster schedule)
  enabled           boolean not null default true,  -- superadmin per-test on/off
  -- Availability override on top of the date gate:
  --   'auto'   → locked while scheduled_date is in the future (IST)
  --   'open'   → force-open regardless of the date
  --   'closed' → force-closed regardless of the date
  open_override     text not null default 'auto'
                    check (open_override in ('auto', 'open', 'closed')),
  sort_order        integer not null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Seed the 13 tests (insert-only; re-runs leave existing admin edits untouched).
-- Dates + blueprint from the "TNPSC Mentor Test Marathon 2026 — Group 1" poster.
insert into public.test_series
  (id, test_set, title, title_ta, unit_label, unit_label_ta,
   subjects_label, subjects_label_ta,
   total_questions, duration_seconds, scheduled_date, sort_order)
values
  ('test1',  1,  'Test 1',  'தேர்வு 1',  'Units I & II', 'அலகு I & II',
   'General Science & Tech · Geography · Aptitude: Simplification',
   'பொது அறிவியல் & தொழில்நுட்பம் · புவியியல் · எண்ணியல்: எளிமையாக்கல்',
   100, 5400, '2026-07-09', 1),
  ('test2',  2,  'Test 2',  'தேர்வு 2',  'Unit III', 'அலகு III',
   'History & Indian National Movement · Aptitude: Percentage, LCM & HCF',
   'வரலாறு & இந்திய தேசிய இயக்கம் · எண்ணியல்: சதவீதம், மீ.பொ.ம & மீ.பொ.வ',
   100, 5400, '2026-07-14', 2),
  ('test3',  3,  'Test 3',  'தேர்வு 3',  'Unit IV', 'அலகு IV',
   'Indian Polity · Aptitude: Ratio & Proportion, Time & Work',
   'இந்திய அரசியலமைப்பு · எண்ணியல்: விகிதம் & விகிதாசாரம், வேலை & நேரம்',
   100, 5400, '2026-07-19', 3),
  ('test4',  4,  'Test 4',  'தேர்வு 4',  'Unit V', 'அலகு V',
   'Indian Economy & Development Administration in Tamil Nadu',
   'இந்தியப் பொருளாதாரம் & தமிழ்நாடு வளர்ச்சி நிர்வாகம்',
   100, 5400, '2026-07-24', 4),
  ('test5',  5,  'Test 5',  'தேர்வு 5',  'Unit VI', 'அலகு VI',
   'Tamil Nadu History, Culture & Socio-Political Movements',
   'தமிழ்நாடு வரலாறு, பண்பாடு & சமூக-அரசியல் இயக்கங்கள்',
   100, 5400, '2026-07-29', 5),
  ('test6',  6,  'Test 6',  'தேர்வு 6',  'Units I & II', 'அலகு I & II',
   'General Science & Tech · Geography · Aptitude: Simple & Compound Interest',
   'பொது அறிவியல் & தொழில்நுட்பம் · புவியியல் · எண்ணியல்: தனி & கூட்டு வட்டி',
   100, 5400, '2026-08-02', 6),
  ('test7',  7,  'Test 7',  'தேர்வு 7',  'Unit III', 'அலகு III',
   'History & Indian National Movement · Aptitude: Area & Volume',
   'வரலாறு & இந்திய தேசிய இயக்கம் · எண்ணியல்: பரப்பளவு & கன அளவு',
   100, 5400, '2026-08-06', 7),
  ('test8',  8,  'Test 8',  'தேர்வு 8',  'Unit IV', 'அலகு IV',
   'Indian Polity · Reasoning',
   'இந்திய அரசியலமைப்பு · தர்க்கப் பகுத்தறிவு',
   100, 5400, '2026-08-10', 8),
  ('test9',  9,  'Test 9',  'தேர்வு 9',  'Unit V', 'அலகு V',
   'Indian Economy & Development Administration in Tamil Nadu',
   'இந்தியப் பொருளாதாரம் & தமிழ்நாடு வளர்ச்சி நிர்வாகம்',
   100, 5400, '2026-08-14', 9),
  ('test10', 10, 'Test 10', 'தேர்வு 10', 'Unit VI', 'அலகு VI',
   'Tamil Nadu History, Culture & Socio-Political Movements',
   'தமிழ்நாடு வரலாறு, பண்பாடு & சமூக-அரசியல் இயக்கங்கள்',
   100, 5400, '2026-08-18', 10),
  ('test11', 11, 'Test 11', 'தேர்வு 11', 'Full Mock', 'முழு மாதிரி',
   'Full Syllabus', 'முழு பாடத்திட்டம்',
   200, 10800, '2026-08-23', 11),
  ('test12', 12, 'Test 12', 'தேர்வு 12', 'Full Mock', 'முழு மாதிரி',
   'Full Syllabus', 'முழு பாடத்திட்டம்',
   200, 10800, '2026-08-27', 12),
  ('test13', 13, 'Test 13', 'தேர்வு 13', 'Full Mock', 'முழு மாதிரி',
   'Full Syllabus', 'முழு பாடத்திட்டம்',
   200, 10800, '2026-08-31', 13)
on conflict (id) do nothing;

-- ─── 4. Per-user attempts ledger (recorded at submit; caps at 2) ─────────────
create table if not exists public.test_series_attempts (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  test_id      text not null references public.test_series(id) on delete cascade,
  session_id   uuid references public.test_sessions(id) on delete set null,
  score        numeric,
  total        integer,
  submitted_at timestamptz not null default now()
);
create index if not exists idx_test_series_attempts_user_test
  on public.test_series_attempts (user_id, test_id);

-- ─── 5. Row-level security ───────────────────────────────────────────────────
-- test_series: any authenticated user may READ (the server applies premium +
-- date gating; disabled rows are simply filtered out server-side). No client
-- writes — edits flow through the is_admin()-gated admin_set_test_series RPC.
alter table public.test_series enable row level security;
drop policy if exists test_series_select on public.test_series;
create policy test_series_select on public.test_series
  for select to authenticated using (true);

-- test_series_attempts: a user may read and insert only their own rows.
alter table public.test_series_attempts enable row level security;
drop policy if exists test_series_attempts_select on public.test_series_attempts;
create policy test_series_attempts_select on public.test_series_attempts
  for select to authenticated using (user_id = auth.uid());
drop policy if exists test_series_attempts_insert on public.test_series_attempts;
create policy test_series_attempts_insert on public.test_series_attempts
  for insert to authenticated with check (user_id = auth.uid());

-- ─── 6. Admin write RPC (SECURITY DEFINER + is_admin(), like mock_exams.sql) ──
-- NULL params leave the corresponding column unchanged, so the client can patch
-- a single field. Returns the updated row.
create or replace function public.admin_set_test_series(
  p_id               text,
  p_enabled          boolean default null,
  p_open_override    text    default null,
  p_scheduled_date   date    default null,
  p_duration_seconds integer default null,
  p_negative_mark    numeric default null,
  p_title            text    default null
)
returns public.test_series
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.test_series;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_open_override is not null
     and p_open_override not in ('auto', 'open', 'closed') then
    raise exception 'invalid open_override: %', p_open_override;
  end if;

  update public.test_series set
    enabled          = coalesce(p_enabled, enabled),
    open_override    = coalesce(p_open_override, open_override),
    scheduled_date   = coalesce(p_scheduled_date, scheduled_date),
    duration_seconds = coalesce(p_duration_seconds, duration_seconds),
    negative_mark    = coalesce(p_negative_mark, negative_mark),
    title            = coalesce(p_title, title),
    updated_at       = now()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'test series % not found', p_id;
  end if;
  return v_row;
end;
$$;

grant execute on function
  public.admin_set_test_series(text, boolean, text, date, integer, numeric, text)
  to authenticated;
