-- ============================================================================
-- TNPSC Mentors — Subject Practice bank (rewritten content) + provenance tag
-- ----------------------------------------------------------------------------
-- The new student-facing "Subject Practice" flow stores the 13 academic
-- subjects (History, Botany, Polity, …) under category='subject', drilled by
-- subject -> topic -> question_type (chronological / match / assertion_reason /
-- statements / direct). Re-runnable / idempotent.
--   • Widen the category CHECK to allow 'subject'.
--   • Add questions.source_tag — a short provenance marker (e.g. 'TU') rendered
--     as a small badge below the question. Used to flag the rewritten Current
--     Affairs set that is merged into the live CA bank.
-- (get_quiz_questions gains the question_type filter + returns source_tag in
--  supabase/active_flag.sql, re-run alongside this file.)
-- ============================================================================

alter table public.questions
  drop constraint if exists questions_category_check;

alter table public.questions
  add constraint questions_category_check
  check (category in ('pyq', 'samacheer', 'current_affairs', 'aptitude', 'outer', 'subject'));

alter table public.questions
  add column if not exists source_tag text;

-- Helps the subject -> topic -> type pickers and quiz sampling.
create index if not exists idx_questions_subject_bank
  on public.questions(category, subject, topic, question_type)
  where category = 'subject';
