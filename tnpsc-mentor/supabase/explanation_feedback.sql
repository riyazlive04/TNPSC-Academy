-- ============================================================================
-- TNPSC Mentor — per-explanation thumbs up/down
-- ----------------------------------------------------------------------------
-- While reviewing answers, a student can rate each explanation. A thumbs-down
-- flags an explanation that "needs work". One vote per user per question
-- (re-voting updates it). Idempotent.
-- ============================================================================

create table if not exists public.explanation_feedback (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  vote        text not null check (vote in ('up', 'down')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, question_id)
);

-- Fast lookup of explanations flagged as needing work.
create index if not exists idx_expl_fb_down
  on public.explanation_feedback (question_id) where vote = 'down';

alter table public.explanation_feedback enable row level security;

-- Students manage their own vote (insert / update / read).
drop policy if exists "manage own explanation_feedback" on public.explanation_feedback;
create policy "manage own explanation_feedback"
  on public.explanation_feedback for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Superadmins can read every vote for triage.
drop policy if exists "superadmin read explanation_feedback" on public.explanation_feedback;
create policy "superadmin read explanation_feedback"
  on public.explanation_feedback for select to authenticated
  using (public.is_superadmin());

grant select, insert, update on public.explanation_feedback to authenticated;
