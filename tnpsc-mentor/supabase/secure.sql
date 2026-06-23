-- ============================================================================
-- TNPSC Mentors — Security & integrity migration
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
-- AUTHORITATIVE definition. This is the single source of truth for the quiz
-- sampler; supabase/active_flag.sql and supabase/history_periods.sql carry an
-- IDENTICAL body so any migration re-run order converges to the same function.
-- Return-shape change (adds source_tag) → callers must DROP before recreating.
-- Filters: active-only, 'outer' kept out of student tests, and the picker
-- narrows by subject / standard / topic / unit / question_type when supplied.
create or replace function public.get_quiz_questions(p_config jsonb)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, images jsonb, source_tag text,
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
      p_config->>'unit'                                as unit,
      p_config->>'question_type'                       as question_type,
      p_config->>'ca_type'                             as ca_type,
      p_config->>'ca_month'                            as ca_month,
      p_config->>'ca_topic'                            as ca_topic,
      p_config->>'aptitude_type'                       as aptitude_type,
      p_config->>'aptitude_topic'                      as aptitude_topic,
      coalesce((p_config->>'mock')::boolean, false)    as mock,
      coalesce((p_config->>'scopeToCategory')::boolean, false) as scope_to_category,
      -- Revision re-tests pass exclude_ids so already-seen questions are skipped
      -- (serves SIMILAR questions from the same scope, not identical ones).
      case when p_config ? 'exclude_ids'
        then array(select (jsonb_array_elements_text(p_config->'exclude_ids'))::uuid)
        else null end                                  as exclude_ids,
      greatest(coalesce((p_config->>'limit')::int, 100), 1)    as lim
  )
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images, q.source_tag,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q
  cross join cfg
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
  where
    q.active
    -- 'outer' is an admin-only subject bank: keep it out of student tests.
    -- It only surfaces when a config explicitly asks for category='outer'.
    and (q.category <> 'outer' or cfg.category = 'outer')
    and case when cfg.mock
      then (not cfg.scope_to_category or q.category = cfg.category)
      else q.category = cfg.category
    end
    and (cfg.mock or cfg.subject        is null or q.subject        = cfg.subject)
    and (cfg.mock or cfg.standard       is null or q.standard       = cfg.standard)
    and (cfg.mock or cfg.topic          is null or q.topic          = cfg.topic)
    and (cfg.mock or cfg.unit           is null or q.unit           = cfg.unit)
    and (cfg.mock or cfg.question_type  is null or q.question_type  = cfg.question_type)
    and (cfg.mock or cfg.ca_type        is null or q.ca_type        = cfg.ca_type)
    and (cfg.mock or cfg.ca_month       is null or q.ca_month       = cfg.ca_month)
    and (cfg.mock or cfg.ca_topic       is null or q.ca_topic       = cfg.ca_topic)
    and (cfg.mock or cfg.aptitude_type  is null or q.aptitude_type  = cfg.aptitude_type)
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic)
    and (cfg.exclude_ids is null or not (q.id = any(cfg.exclude_ids)))
  -- Unseen first; among seen, longest-ago first; random within each group.
  order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
  limit (select lim from cfg);
$$;

-- ─── 3b. Submit & grade a test (server is the sole grader) ──────────────────
-- p_session : { category, group_type, subject, standard, ca_month, ca_type,
--               aptitude_type, aptitude_topic, total_questions,
--               time_limit_seconds, time_taken_seconds }
-- p_answers : [ { question_id, selected_answer|null, time_spent_seconds,
--                 flagged } ]  — one entry PER shown question.
-- Returns the graded result; correct answers + explanations are included ONLY
-- when the attendance gate (>= 25% attempted) is met.
create or replace function public.submit_test(p_session jsonb, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_total     int;
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
  -- v_total is DERIVED from the submitted answer rows that join to real
  -- questions — NOT taken from the client's p_session.total_questions, which a
  -- malicious client could forge (e.g. claim total_questions=1 while sending
  -- many answers, or vice-versa) to fake a 100% score or skew the unlock gate.
  select
    count(*),
    count(*) filter (where a.selected_answer is not null),
    count(*) filter (where a.selected_answer is not null
                       and a.selected_answer = q.correct_answer)
  into v_total, v_attempted, v_correct
  from jsonb_to_recordset(p_answers)
       as a(question_id uuid, selected_answer text,
             time_spent_seconds numeric, flagged boolean)
  join public.questions q on q.id = a.question_id;

  v_total     := coalesce(v_total, 0);
  v_attempted := coalesce(v_attempted, 0);
  v_correct   := coalesce(v_correct, 0);
  v_score  := case when v_total > 0 then round(100.0 * v_correct / v_total) else 0 end;
  -- Explanations unlock once the student has attempted at least 25% of the test.
  v_passed := v_total > 0 and v_attempted::numeric / v_total >= 0.25;

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

-- ─── 3f-bis. Count available questions for a config ─────────────────────────
-- Powers the pre-test setup: the question-count slider is bounded by how many
-- questions actually exist for the chosen topic. WHERE mirrors get_quiz_questions
-- EXACTLY (minus order/limit) so the count matches what a real fetch would draw.
create or replace function public.count_quiz_questions(p_config jsonb)
returns integer
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
      p_config->>'unit'                                as unit,
      p_config->>'question_type'                       as question_type,
      p_config->>'ca_type'                             as ca_type,
      p_config->>'ca_month'                            as ca_month,
      p_config->>'ca_topic'                            as ca_topic,
      p_config->>'aptitude_type'                       as aptitude_type,
      p_config->>'aptitude_topic'                      as aptitude_topic,
      coalesce((p_config->>'mock')::boolean, false)    as mock,
      coalesce((p_config->>'scopeToCategory')::boolean, false) as scope_to_category
  )
  select count(*)::int
  from public.questions q, cfg
  where
    q.active
    and (q.category <> 'outer' or cfg.category = 'outer')
    and case when cfg.mock
      then (not cfg.scope_to_category or q.category = cfg.category)
      else q.category = cfg.category
    end
    and (cfg.mock or cfg.subject        is null or q.subject        = cfg.subject)
    and (cfg.mock or cfg.standard       is null or q.standard       = cfg.standard)
    and (cfg.mock or cfg.topic          is null or q.topic          = cfg.topic)
    and (cfg.mock or cfg.unit           is null or q.unit           = cfg.unit)
    and (cfg.mock or cfg.question_type  is null or q.question_type  = cfg.question_type)
    and (cfg.mock or cfg.ca_type        is null or q.ca_type        = cfg.ca_type)
    and (cfg.mock or cfg.ca_month       is null or q.ca_month       = cfg.ca_month)
    and (cfg.mock or cfg.ca_topic       is null or q.ca_topic       = cfg.ca_topic)
    and (cfg.mock or cfg.aptitude_type  is null or q.aptitude_type  = cfg.aptitude_type)
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic);
$$;

-- ─── 3g. Distinct topics for the pickers (avoids PostgREST's 1000-row cap) ───
-- The /topics endpoint previously downloaded every matching row and computed
-- DISTINCT in JS — capped at 1000 rows, so banks larger than 1000 returned an
-- incomplete topic list. This computes DISTINCT server-side regardless of size.
create or replace function public.distinct_question_topics(p_config jsonb)
returns table(topic text)
language sql
security definer
stable
set search_path = public
as $$
  with cfg as (
    select
      p_config->>'category'        as category,
      p_config->>'subject'         as subject,
      (p_config->>'standard')::int as standard,
      p_config->>'aptitude_type'   as aptitude_type
  )
  select t from (
    select distinct
      case
        when cfg.category = 'aptitude'        then q.aptitude_topic
        when cfg.category = 'current_affairs' then coalesce(q.topic, q.ca_topic)
        else q.topic
      end as t
    from public.questions q, cfg
    where q.category = cfg.category
      -- 'samacheer' and 'current_affairs' historically included inactive rows;
      -- the other categories restrict to active. Mirror the original behaviour.
      and (cfg.category in ('samacheer', 'current_affairs') or q.active)
      and (cfg.subject is null or q.subject = cfg.subject)
      and (cfg.standard is null or q.standard = cfg.standard)
      and (cfg.aptitude_type is null or cfg.category <> 'aptitude'
            or q.aptitude_type = cfg.aptitude_type)
  ) s
  where t is not null
  order by t;
$$;

-- ─── 3h. Grouped value counts for the pickers (qtypes / history periods) ─────
create or replace function public.subject_qtype_counts(p_subject text, p_topic text)
returns table(value text, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  select q.question_type, count(*)
  from public.questions q
  where q.category = 'subject' and q.active and q.question_type is not null
    and (p_subject is null or q.subject = p_subject)
    and (p_topic   is null or q.topic   = p_topic)
  group by q.question_type;
$$;

-- Per-topic question counts for a Subject-Practice subject. Powers the count
-- shown on each topic row of the Topic step (and the "All Topics" total).
create or replace function public.subject_topic_counts(p_subject text)
returns table(value text, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  select q.topic, count(*)
  from public.questions q
  where q.category = 'subject' and q.active and q.topic is not null
    and (p_subject is null or q.subject = p_subject)
  group by q.topic;
$$;

-- Per-topic question counts for ANY category's topic picker. Mirrors the
-- per-category column logic of distinct_question_topics (aptitude_topic /
-- topic-or-ca_topic / topic) so the Aptitude, Current-Affairs, Samacheer and
-- Subject pickers can all show a count on every topic row from one call.
create or replace function public.question_topic_counts(p_config jsonb)
returns table(value text, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  with cfg as (
    select
      p_config->>'category'        as category,
      p_config->>'subject'         as subject,
      (p_config->>'standard')::int as standard,
      p_config->>'aptitude_type'   as aptitude_type
  )
  select t, count(*) from (
    select
      case
        when cfg.category = 'aptitude'        then q.aptitude_topic
        when cfg.category = 'current_affairs' then coalesce(q.topic, q.ca_topic)
        else q.topic
      end as t
    from public.questions q, cfg
    where q.category = cfg.category
      -- Match distinct_question_topics' active rule per category.
      and (cfg.category in ('samacheer', 'current_affairs') or q.active)
      and (cfg.subject is null or q.subject = cfg.subject)
      and (cfg.standard is null or q.standard = cfg.standard)
      and (cfg.aptitude_type is null or cfg.category <> 'aptitude'
            or q.aptitude_type = cfg.aptitude_type)
  ) s
  where t is not null
  group by t;
$$;

create or replace function public.pyq_history_period_counts()
returns table(value text, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  select q.unit, count(*)
  from public.questions q
  where q.category = 'pyq' and q.subject = 'History and INM'
    and q.active and q.unit is not null
  group by q.unit;
$$;

-- ─── 3i. Random mock samples (server-side ORDER BY random, no 1000-row cap) ──
-- Subject/topic mock with optional difficulty. Answer columns are NOT returned.
create or replace function public.subject_mock_questions(
  p_subject text, p_topic text, p_difficulty text, p_count int
)
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
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
  where q.category = 'subject' and q.active
    and (p_subject    is null or q.subject    = p_subject)
    and (p_topic      is null or q.topic      = p_topic)
    and (p_difficulty is null or q.difficulty = p_difficulty)
  order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
  limit greatest(least(coalesce(p_count, 50), 200), 1);
$$;

-- One group-exam slot: union of {category, subjects?} queries, de-duplicated,
-- randomly sampled to p_count. p_queries = [{ "category": text, "subjects": [text] }].
create or replace function public.mock_slot_questions(p_queries jsonb, p_count int)
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
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
  where q.active
    -- match ANY of the slot's queries; the EXISTS dedupes (each row once).
    and exists (
      select 1
      from jsonb_array_elements(p_queries) elem
      where q.category = elem->>'category'
        and (
          -- No subjects filter when the key is absent OR an explicit JSON null
          -- (the API sends "subjects": null for whole-category slots such as
          -- aptitude / current_affairs). Only an actual array narrows by subject;
          -- jsonb_array_elements_text() on a non-array would raise and 400 the call.
          jsonb_typeof(elem->'subjects') is distinct from 'array'
          or q.subject = any (
            select jsonb_array_elements_text(elem->'subjects')
          )
        )
    )
  order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
  limit greatest(coalesce(p_count, 0), 0);
$$;

-- ─── 3j. Atomic daily-activity increment (no read-modify-write race) ─────────
-- The previous route read the row, added in JS, and wrote the sum — two
-- concurrent submits could both read the same value and lose one increment.
-- This performs the add atomically inside the upsert.
create or replace function public.increment_activity(p_questions int, p_tests int)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.daily_activity (user_id, activity_date, questions, tests)
  values (auth.uid(), current_date, greatest(coalesce(p_questions, 0), 0),
          greatest(coalesce(p_tests, 0), 0))
  on conflict (user_id, activity_date)
  do update set questions = public.daily_activity.questions + excluded.questions,
                tests     = public.daily_activity.tests + excluded.tests;
$$;

-- ─── 4. Execute grants ──────────────────────────────────────────────────────
grant execute on function public.get_quiz_questions(jsonb)   to authenticated;
grant execute on function public.count_quiz_questions(jsonb) to authenticated;
grant execute on function public.subject_practice_subjects() to authenticated;
grant execute on function public.submit_test(jsonb, jsonb)   to authenticated;
grant execute on function public.get_due_reviews(int)        to authenticated;
grant execute on function public.grade_review(uuid, text)    to authenticated;
grant execute on function public.admin_list_questions(jsonb) to authenticated;
grant execute on function public.distinct_question_topics(jsonb) to authenticated;
grant execute on function public.subject_qtype_counts(text, text) to authenticated;
grant execute on function public.subject_topic_counts(text)   to authenticated;
grant execute on function public.question_topic_counts(jsonb) to authenticated;
grant execute on function public.pyq_history_period_counts()  to authenticated;
grant execute on function public.subject_mock_questions(text, text, text, int) to authenticated;
grant execute on function public.mock_slot_questions(jsonb, int) to authenticated;
grant execute on function public.increment_activity(int, int) to authenticated;
