-- ============================================================================
-- TNPSC Mentor — Supabase schema
-- ============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Questions ──────────────────────────────────────────────────────────────
create table if not exists questions (
  id uuid default uuid_generate_v4() primary key,
  category text not null check (category in ('pyq', 'samacheer', 'current_affairs', 'aptitude')),

  -- PYQ fields
  group_type text check (group_type in ('Group1', 'Group2_2A', 'Group4_VAO')),
  year integer,

  -- Samacheer fields
  standard integer check (standard in (6, 7, 8, 9, 10)),

  -- Current Affairs fields
  ca_month text,    -- e.g. 'August 2025'
  ca_year integer,  -- e.g. 2025
  ca_type text check (ca_type in ('topic_wise', 'month_wise')),
  ca_topic text,    -- e.g. 'Science & Technology'

  -- Aptitude fields
  aptitude_type text check (aptitude_type in ('numerics', 'reasoning')),
  aptitude_topic text,  -- e.g. 'Simplification', 'Dice'

  -- Subject (shared across PYQ and Samacheer)
  subject text,
  -- Values: 'History and INM', 'Polity', 'History Culture Heritage of TN',
  --         'Development Administration of TamilNadu', 'Biology',
  --         'Physics', 'Chemistry', 'Indian Economy', 'Current Affairs', 'Aptitude'

  topic text,   -- chapter/topic within the subject

  -- Question content
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  explanation text,

  -- Metadata
  difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  source_url text,
  created_at timestamptz default now()
);

-- Optional Tamil (bilingual) content — added separately so existing English
-- rows are untouched. The frontend renders these when the user picks Tamil/Both
-- and falls back to English when a column is null.
alter table questions add column if not exists question_text_ta text;
alter table questions add column if not exists option_a_ta text;
alter table questions add column if not exists option_b_ta text;
alter table questions add column if not exists option_c_ta text;
alter table questions add column if not exists option_d_ta text;
alter table questions add column if not exists explanation_ta text;

-- Indexes for fast filtering
create index if not exists idx_questions_category on questions(category);
create index if not exists idx_questions_group_type on questions(group_type);
create index if not exists idx_questions_subject on questions(subject);
create index if not exists idx_questions_ca_month on questions(ca_month);
create index if not exists idx_questions_ca_topic on questions(ca_topic);
create index if not exists idx_questions_aptitude_topic on questions(aptitude_topic);
create index if not exists idx_questions_standard on questions(standard);
create index if not exists idx_questions_topic on questions(topic);

-- ─── Test Sessions ──────────────────────────────────────────────────────────
create table if not exists test_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,

  -- What test this is
  category text not null,
  group_type text,
  subject text,
  standard integer,
  ca_month text,
  ca_type text,
  aptitude_type text,
  aptitude_topic text,

  -- Results
  total_questions integer not null,
  attempted integer default 0,
  correct integer default 0,
  score_percentage float default 0,

  -- Gating
  pdf_unlocked boolean default false,
  passed_80_percent boolean default false,

  -- Timing
  time_limit_seconds integer not null,
  time_taken_seconds integer,
  started_at timestamptz default now(),
  completed_at timestamptz,

  status text default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned'))
);

create index if not exists idx_sessions_user on test_sessions(user_id);

-- ─── Individual Answers ─────────────────────────────────────────────────────
create table if not exists test_answers (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references test_sessions(id) on delete cascade,
  question_id uuid references questions(id),
  selected_answer text check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct boolean,
  time_spent_seconds float default 0,
  flagged boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_answers_session on test_answers(session_id);

-- ─── Smart Revision (spaced repetition) ─────────────────────────────────────
-- Wrong / flagged questions land here and resurface on an SM-2-lite schedule.
create table if not exists review_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  due_at timestamptz default now(),
  interval_days integer default 0,
  reps integer default 0,
  last_result text check (last_result in ('correct', 'wrong')),
  created_at timestamptz default now(),
  unique (user_id, question_id)
);

create index if not exists idx_review_user_due on review_items(user_id, due_at);

-- ─── User Profiles ──────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  email text,
  phone text,
  target_group text check (target_group in ('Group1', 'Group2_2A', 'Group4_VAO')),
  -- Role: regular aspirants take timed tests; admins see the full question bank.
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table questions enable row level security;
alter table test_sessions enable row level security;
alter table test_answers enable row level security;
alter table profiles enable row level security;
alter table review_items enable row level security;

drop policy if exists "Users can manage own review items" on review_items;
create policy "Users can manage own review items"
  on review_items for all to authenticated
  using (auth.uid() = user_id);

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Policies -------------------------------------------------------------------

-- Everyone authenticated can read questions (admins included — they simply
-- read the same rows but the UI reveals answers to them).
drop policy if exists "Questions are readable by authenticated users" on questions;
create policy "Questions are readable by authenticated users"
  on questions for select to authenticated using (true);

-- Admins can also insert/update/delete questions.
drop policy if exists "Admins manage questions" on questions;
create policy "Admins manage questions"
  on questions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can manage own sessions" on test_sessions;
create policy "Users can manage own sessions"
  on test_sessions for all to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own answers" on test_answers;
create policy "Users can manage own answers"
  on test_answers for all to authenticated
  using (session_id in (
    select id from test_sessions where user_id = auth.uid()
  ));

drop policy if exists "Users can manage own profile" on profiles;
create policy "Users can manage own profile"
  on profiles for all to authenticated
  using (auth.uid() = id);

-- ─── Auto-create profile on signup ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Promote a user to admin (run manually) ─────────────────────────────────
-- To make someone an admin, run (replacing the email):
--   update public.profiles set role = 'admin'
--   where email = 'admin@tnpsc.app';
