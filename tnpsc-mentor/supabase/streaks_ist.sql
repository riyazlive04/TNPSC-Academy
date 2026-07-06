-- ─── Streaks & goals: align daily_activity to the IST calendar day ──────────
-- The habit layer READS streaks in IST (src/lib/habit.ts todayIso) and the
-- daily credit grant already keys on (now() at time zone 'Asia/Kolkata')::date,
-- but the activity WRITES keyed on current_date — UTC on Supabase. A test
-- submitted between 00:00 and 05:30 IST therefore landed on the previous IST
-- day and never counted as "today", silently breaking early-morning streaks.
-- This migration (a) re-keys both writers on the IST day, (b) fixes the column
-- default, and (c) rebuilds the ledger from test_sessions.completed_at (its
-- only real source — submit_test is the sole writer the app exercises) so
-- history is on IST days too. Run: node run-migration.mjs ../supabase/streaks_ist.sql

begin;

-- 1) Column default: never let a defaulted insert key on UTC.
alter table public.daily_activity
  alter column activity_date set default ((now() at time zone 'Asia/Kolkata')::date);

-- 2) submit_test — the habit insert now keys on the IST day. Body otherwise
--    identical to the live definition (verified against prod 2026-07-06).
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

  -- Habit: record today's activity (streaks + daily goal) on the IST day.
  insert into public.daily_activity (user_id, activity_date, questions, tests)
  values (v_user, (now() at time zone 'Asia/Kolkata')::date, v_attempted, 1)
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
           'explanation_video_url', case when v_passed then q.explanation_video_url end,
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

-- 3) increment_activity — same IST re-key.
create or replace function public.increment_activity(p_questions int, p_tests int)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.daily_activity (user_id, activity_date, questions, tests)
  values (auth.uid(), (now() at time zone 'Asia/Kolkata')::date,
          greatest(coalesce(p_questions, 0), 0),
          greatest(coalesce(p_tests, 0), 0))
  on conflict (user_id, activity_date)
  do update set questions = public.daily_activity.questions + excluded.questions,
                tests     = public.daily_activity.tests + excluded.tests;
$$;

-- 4) Rebuild the ledger from its source of truth at IST day boundaries.
--    daily_activity is derived data: submit_test is its only writer in
--    practice, so regrouping completed sessions reproduces it faithfully
--    (and extends it to sessions older than the table itself).
delete from public.daily_activity;
insert into public.daily_activity (user_id, activity_date, questions, tests)
select user_id,
       (completed_at at time zone 'Asia/Kolkata')::date,
       coalesce(sum(attempted), 0),
       count(*)
from public.test_sessions
where status = 'completed' and completed_at is not null
group by user_id, (completed_at at time zone 'Asia/Kolkata')::date;

commit;
