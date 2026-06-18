-- ============================================================================
-- TNPSC Mentor — student "mark this question for correction" reports
-- ----------------------------------------------------------------------------
-- During a test (mock or practice) a student can flag a question that looks
-- wrong — bad answer key, typo, broken option — so admins can review and fix
-- it. This is SEPARATE from explanation_feedback (which rates explanation
-- quality during answer review) and from the personal "flag for review" (which
-- is in-memory navigation only). One report per user per question; re-tapping
-- removes it. Idempotent / re-runnable.
-- ============================================================================

create table if not exists public.question_reports (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  reason      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, question_id)
);

-- Fast triage: how many distinct students reported each question.
create index if not exists idx_question_reports_qid
  on public.question_reports (question_id);

alter table public.question_reports enable row level security;

-- Students manage their own reports (insert / update / delete / read).
drop policy if exists "manage own question_reports" on public.question_reports;
create policy "manage own question_reports"
  on public.question_reports for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admins + superadmins can read every report for triage.
drop policy if exists "admin read question_reports" on public.question_reports;
create policy "admin read question_reports"
  on public.question_reports for select to authenticated
  using (public.is_admin() or public.is_superadmin());

grant select, insert, update, delete on public.question_reports to authenticated;
