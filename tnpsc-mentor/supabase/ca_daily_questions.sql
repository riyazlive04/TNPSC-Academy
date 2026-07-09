-- ============================================================================
-- TNPSC Mentors — CA generator: DAILY question drops → ca_daily_questions
-- ----------------------------------------------------------------------------
-- Companion to ca_generator.sql (see work/TNPSC/APP_INTEGRATION.md). The VPS
-- pipeline pushes a small day_wise question set each morning alongside the
-- magazine items — kept OUT of public.questions so the daily drop can never
-- leak into the monthly banks or the general samplers. Same push semantics:
-- INSERT-ONLY on the UNIQUE external_id (REST ?on_conflict=external_id),
-- service_role key. RLS is ON with NO policies → only service-role clients
-- (the pipeline and the Express server) touch it. Idempotent.
-- ============================================================================

create table if not exists public.ca_daily_questions (
  id              bigint generated always as identity primary key,
  external_id     text not null unique,
  category        text not null default 'current_affairs',
  ca_type         text not null default 'day_wise' check (ca_type = 'day_wise'),
  date            date not null,
  ca_month        text,
  ca_year         int,
  ca_topic        text,
  topic           text,
  question_type   text,
  question_text   text,
  option_a        text,
  option_b        text,
  option_c        text,
  option_d        text,
  correct_answer  text,
  explanation     text,
  difficulty      text,
  source_url      text default 'the-hindu-print',
  why_wrong       jsonb default '{}'::jsonb,
  question_text_ta text,
  option_a_ta     text,
  option_b_ta     text,
  option_c_ta     text,
  option_d_ta     text,
  explanation_ta  text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.ca_daily_questions enable row level security;

create index if not exists ca_daily_questions_date_idx on public.ca_daily_questions (date);
