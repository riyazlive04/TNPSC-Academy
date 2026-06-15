-- ============================================================================
-- TNPSC Mentor — Security & integrity migration
-- ----------------------------------------------------------------------------
-- Run this AFTER schema.sql. It closes the "answers shipped to the browser"
-- leak and moves grading to the server so scores can't be forged.
--
-- What it does:
--   1. Hides the answer-bearing columns (correct_answer, explanation,
--      explanation_ta, why_wrong) from the `authenticated` role at the
--      column-grant level, so no raw PostgREST query can read them.
--   2. Adds SECURITY DEFINER RPCs that are the ONLY way to:
--        • fetch quiz questions      -> get_quiz_questions  (no answers)
--        • submit & grade a test     -> submit_test         (server grades)
--        • run the spaced-revision   -> get_due_reviews / grade_review
--        • read the admin bank       -> admin_list_questions (is_admin gated)
--   3. Adds composite indexes for the common Samacheer/PYQ filters.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ─── 1. Column-level read privileges on questions ───────────────────────────
-- Revoke the blanket SELECT, then grant back every column EXCEPT the answer /
-- explanation columns. RLS still applies on top of this. SECURITY DEFINER
-- functions below run as the owner and bypass these grants internally, so they
-- can still read correct_answer to grade — they just never return it ungated.
revoke select on public.questions from authenticated, anon;

grant select (
  id, category, group_type, year, standard,
  ca_month, ca_year, ca_type, ca_topic,
  aptitude_type, aptitude_topic, subject, topic,
  question_type, external_id,
  question_text, option_a, option_b, option_c, option_d,
  difficulty, source_url, created_at, images,
  question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta
) on public.questions to authenticated;

-- ─── 2. Composite indexes for common multi-column filters ───────────────────
create index if not exists idx_questions_samacheer
  on public.questions(subject, standard, topic);
create index if not exists idx_questions_pyq
  on public.questions(category, subject);

-- ─── 3a. Quiz questions (NO answers) ────────────────────────────────────────
-- Returns up to `limit` random questions matching the config. Random ordering
-- fixes the previous "always the oldest 100" sampling bug and the mock-mode
-- 1000-row client download.
create or replace function public.get_quiz_questions(p_config jsonb)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, images jsonb,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text
)
language sql
security definer
stable
set search_path = public
as $$
  with cfg as (
    select
      p_config->>'category'                            as category,
      p_config->>'subject'                             as subject,
      (p_config->>'standard')::int                     as standard,
      p_config->>'topic'                               as topic,
      p_config->>'ca_type'                             as ca_type,
      p_config->>'ca_month'                            as ca_month,
      p_config->>'ca_topic'                            as ca_topic,
      p_config->>'aptitude_type'                       as aptitude_type,
      p_config->>'aptitude_topic'                      as aptitude_topic,
      coalesce((p_config->>'mock')::boolean, false)    as mock,
      coalesce((p_config->>'scopeToCategory')::boolean, false) as scope_to_category,
      greatest(coalesce((p_config->>'limit')::int, 100), 1)    as lim
  )
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q, cfg
  where
    case when cfg.mock
      then (not cfg.scope_to_category or q.category = cfg.category)
      else q.category = cfg.category
    end
    and (cfg.mock or cfg.subject        is null or q.subject        = cfg.subject)
    and (cfg.mock or cfg.standard       is null or q.standard       = cfg.standard)
    and (cfg.mock or cfg.topic          is null or q.topic          = cfg.topic)
    and (cfg.mock or cfg.ca_type        is null or q.ca_type        = cfg.ca_type)
    and (cfg.mock or cfg.ca_month       is null or q.ca_month       = cfg.ca_month)
    and (cfg.mock or cfg.ca_topic       is null or q.ca_topic       = cfg.ca_topic)
    and (cfg.mock or cfg.aptitude_type  is null or q.aptitude_type  = cfg.aptitude_type)
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic)
  order by random()
  limit (select lim from cfg);
$$;

-- ─── 3b. Submit & grade a test (server is the sole grader) ──────────────────
-- p_session : { category, group_type, subject, standard, ca_month, ca_type,
--               aptitude_type, aptitude_topic, total_questions,
--               time_limit_seconds, time_taken_seconds }
-- p_answers : [ { question_id, selected_answer|null, time_spent_seconds,
--                 flagged } ]  — one entry PER shown question.
-- Returns the graded result; correct answers + explanations are included ONLY
-- when the 80% attendance gate is met.
create or replace function public.submit_test(p_session jsonb, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_total     int  := coalesce((p_session->>'total_questions')::int, 0);
  v_attempted int;
  v_correct   int;
  v_score     int;
  v_passed    boolean;
  v_session_id uuid;
  v_results   jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Grade against the real correct_answer (which the client never sees).
  select
    count(*) filter (where a.selected_answer is not null),
    count(*) filter (where a.selected_answer is not null
                       and a.selected_answer = q.correct_answer)
  into v_attempted, v_correct
  from jsonb_to_recordset(p_answers)
       as a(question_id uuid, selected_answer text,
             time_spent_seconds numeric, flagged boolean)
  join public.questions q on q.id = a.question_id;

  v_attempted := coalesce(v_attempted, 0);
  v_correct   := coalesce(v_correct, 0);
  v_score  := case when v_total > 0 then round(100.0 * v_correct / v_total) else 0 end;
  v_passed := v_total > 0 and v_attempted::numeric / v_total >= 0.8;

  insert into public.test_sessions (
    user_id, category, group_type, subject, standard, ca_month, ca_type,
    aptitude_type, aptitude_topic, total_questions, attempted, correct,
    score_percentage, pdf_unlocked, passed_80_percent, time_limit_seconds,
    time_taken_seconds, completed_at, status
  ) values (
    v_user,
    p_session->>'category',
    p_session->>'group_type',
    p_session->>'subject',
    (p_session->>'standard')::int,
    p_session->>'ca_month',
    p_session->>'ca_type',
    p_session->>'aptitude_type',
    p_session->>'aptitude_topic',
    v_total, v_attempted, v_correct, v_score, v_passed, v_passed,
    coalesce((p_session->>'time_limit_seconds')::int, 0),
    coalesce((p_session->>'time_taken_seconds')::int, 0),
    now(), 'completed'
  ) returning id into v_session_id;

  insert into public.test_answers (
    session_id, question_id, selected_answer, is_correct,
    time_spent_seconds, flagged
  )
  select v_session_id, a.question_id, a.selected_answer,
         (a.selected_answer is not null and a.selected_answer = q.correct_answer),
         coalesce(a.time_spent_seconds, 0), coalesce(a.flagged, false)
  from jsonb_to_recordset(p_answers)
       as a(question_id uuid, selected_answer text,
             time_spent_seconds numeric, flagged boolean)
  join public.questions q on q.id = a.question_id;

  -- Spaced revision: enqueue wrong / unattempted / flagged questions.
  insert into public.review_items (user_id, question_id, due_at, interval_days, reps)
  select v_user, a.question_id, now(), 0, 0
  from jsonb_to_recordset(p_answers)
       as a(question_id uuid, selected_answer text,
             time_spent_seconds numeric, flagged boolean)
  join public.questions q on q.id = a.question_id
  where a.selected_answer is null
     or a.selected_answer <> q.correct_answer
     or coalesce(a.flagged, false)
  on conflict (user_id, question_id) do nothing;

  -- Habit: record today's activity (streaks + daily goal).
  insert into public.daily_activity (user_id, activity_date, questions, tests)
  values (v_user, current_date, v_attempted, 1)
  on conflict (user_id, activity_date)
  do update set questions = public.daily_activity.questions + excluded.questions,
                tests     = public.daily_activity.tests + excluded.tests;

  -- Per-question results; reveal answers/explanations only when unlocked.
  select jsonb_agg(jsonb_build_object(
           'question_id',    a.question_id,
           'selected_answer', a.selected_answer,
           'is_correct',     (a.selected_answer is not null
                               and a.selected_answer = q.correct_answer),
           'correct_answer', case when v_passed then q.correct_answer end,
           'explanation',    case when v_passed then q.explanation end,
           'explanation_ta', case when v_passed then q.explanation_ta end,
           'why_wrong',      case when v_passed then q.why_wrong end
         ))
  into v_results
  from jsonb_to_recordset(p_answers)
       as a(question_id uuid, selected_answer text,
             time_spent_seconds numeric, flagged boolean)
  join public.questions q on q.id = a.question_id;

  return jsonb_build_object(
    'session_id',       v_session_id,
    'total',            v_total,
    'attempted',        v_attempted,
    'correct',          v_correct,
    'score_percentage', v_score,
    'passed_80',        v_passed,
    'unlocked',         v_passed,
    'results',          coalesce(v_results, '[]'::jsonb)
  );
end;
$$;

-- ─── 3b. Record an abandoned (exited mid-way) test session ─────────────────
create or replace function public.record_abandoned_test(p_session jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.test_sessions (
    user_id, category, group_type, subject, standard, ca_month, ca_type,
    aptitude_type, aptitude_topic, total_questions, attempted,
    time_limit_seconds, time_taken_seconds, status
  ) values (
    v_user,
    p_session->>'category',
    p_session->>'group_type',
    p_session->>'subject',
    (p_session->>'standard')::int,
    p_session->>'ca_month',
    p_session->>'ca_type',
    p_session->>'aptitude_type',
    p_session->>'aptitude_topic',
    coalesce((p_session->>'total_questions')::int, 0),
    coalesce((p_session->>'attempted')::int, 0),
    coalesce((p_session->>'time_limit_seconds')::int, 0),
    coalesce((p_session->>'time_taken_seconds')::int, 0),
    'abandoned'
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.record_abandoned_test(jsonb) to authenticated;

-- ─── 3c. Spaced revision: due items (NO answers) ────────────────────────────
create or replace function public.get_due_reviews(p_limit int default 30)
returns table (
  item_id uuid, reps int, interval_days int, due_at timestamptz, last_result text,
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, images jsonb,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text
)
language sql
security definer
stable
set search_path = public
as $$
  select r.id, r.reps, r.interval_days, r.due_at, r.last_result,
         q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.review_items r
  join public.questions q on q.id = r.question_id
  where r.user_id = auth.uid()
    and r.due_at <= now()
  order by r.due_at asc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

-- ─── 3d. Spaced revision: grade one item (server reveals after answering) ───
create or replace function public.grade_review(p_item_id uuid, p_selected text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_qid uuid;
  v_reps int;
  v_correct boolean;
  v_answer text;
  v_explanation text;
  v_explanation_ta text;
  v_interval int;
  intervals int[] := array[1, 3, 7, 16, 35, 75];
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select question_id, reps into v_qid, v_reps
  from public.review_items
  where id = p_item_id and user_id = v_user;
  if v_qid is null then raise exception 'review item not found'; end if;

  select (p_selected = correct_answer), correct_answer, explanation, explanation_ta
  into v_correct, v_answer, v_explanation, v_explanation_ta
  from public.questions where id = v_qid;

  if v_correct then
    -- 1-based array; mirrors the JS INTERVALS[min(reps, len-1)].
    v_interval := intervals[least(v_reps, array_length(intervals, 1) - 1) + 1];
    v_reps := v_reps + 1;
  else
    v_interval := 0;   -- stays due today until answered correctly
    v_reps := 0;
  end if;

  update public.review_items
  set reps = v_reps,
      interval_days = v_interval,
      last_result = case when v_correct then 'correct' else 'wrong' end,
      due_at = now() + make_interval(days => v_interval)
  where id = p_item_id and user_id = v_user;

  return jsonb_build_object(
    'is_correct',     v_correct,
    'correct_answer', v_answer,
    'explanation',    v_explanation,
    'explanation_ta', v_explanation_ta
  );
end;
$$;

-- ─── 3e. Admin question bank (full rows, is_admin gated) ─────────────────────
create or replace function public.admin_list_questions(p_config jsonb)
returns setof public.questions
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;  -- non-admins get nothing
  end if;
  return query
  select * from public.questions q
  where (p_config->>'category'       is null or q.category       = p_config->>'category')
    and (p_config->>'subject'        is null or q.subject        = p_config->>'subject')
    and ((p_config->>'standard')     is null or q.standard       = (p_config->>'standard')::int)
    and (p_config->>'topic'          is null or q.topic          = p_config->>'topic')
    and (p_config->>'ca_type'        is null or q.ca_type        = p_config->>'ca_type')
    and (p_config->>'ca_month'       is null or q.ca_month       = p_config->>'ca_month')
    and (p_config->>'ca_topic'       is null or q.ca_topic       = p_config->>'ca_topic')
    and (p_config->>'aptitude_type'  is null or q.aptitude_type  = p_config->>'aptitude_type')
    and (p_config->>'aptitude_topic' is null or q.aptitude_topic = p_config->>'aptitude_topic')
  order by q.created_at desc
  limit 500;
end;
$$;

-- ─── 3f. Subject Practice subjects (grouped counts) ─────────────────────────
-- The picker needs distinct subjects + a per-subject active count. Doing this
-- with a plain table select hits PostgREST's 1000-row cap (the subject bank has
-- thousands of rows), so only the first one or two subjects ever came back.
-- Grouping server-side returns one row per subject regardless of bank size.
create or replace function public.subject_practice_subjects()
returns table(subject text, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  select q.subject, count(*) as total
  from public.questions q
  where q.category = 'subject'
    and q.active
    and q.subject is not null
  group by q.subject
  order by q.subject;
$$;

-- ─── 4. Execute grants ──────────────────────────────────────────────────────
grant execute on function public.get_quiz_questions(jsonb)   to authenticated;
grant execute on function public.subject_practice_subjects() to authenticated;
grant execute on function public.submit_test(jsonb, jsonb)   to authenticated;
grant execute on function public.get_due_reviews(int)        to authenticated;
grant execute on function public.grade_review(uuid, text)    to authenticated;
grant execute on function public.admin_list_questions(jsonb) to authenticated;
