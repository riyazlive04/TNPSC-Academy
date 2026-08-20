-- ============================================================================
-- TNPSC Mentors — Practice-mode instant answer check
-- ----------------------------------------------------------------------------
-- Reveals the graded answer for ONE question — but only once the server has
-- already legitimately served that exact question to the calling user, i.e.
-- it has a row in seen_questions for them. seen_questions is written at fetch
-- time by every quiz-question route (recordSeen, server/src/lib/seen.ts) right
-- after the 1-credit-per-question charge succeeds — so "checked" always implies
-- "already paid for and actually drawn", the same way get_quiz_questions'
-- column-level revoke already keeps correct_answer off the wire during a test.
--
-- Without the seen_questions gate, a bare "look up any question_id" RPC would
-- let anyone script a full answer-key dump straight from the client. With it,
-- checking still requires going through the normal credit-charged fetch flow
-- first — at which point a user already has full legitimate access to this
-- question's answer via that flow's own Results screen anyway.
--
-- Run this AFTER schema.sql and secure.sql.
-- ============================================================================

create or replace function public.check_answer(p_question_id uuid)
returns table (
  correct_answer text,
  explanation text,
  explanation_ta text,
  explanation_video_url text,
  why_wrong jsonb,
  why_wrong_ta jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select q.correct_answer, q.explanation, q.explanation_ta,
         q.explanation_video_url, q.why_wrong, q.why_wrong_ta
  from public.questions q
  where q.id = p_question_id
    and exists (
      select 1 from public.seen_questions sq
      where sq.question_id = p_question_id and sq.user_id = auth.uid()
    )
$$;

grant execute on function public.check_answer(uuid) to authenticated;
