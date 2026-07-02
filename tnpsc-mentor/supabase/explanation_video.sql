-- ============================================================================
-- TNPSC Mentors — Explanation video (YouTube) per question
-- ----------------------------------------------------------------------------
-- Adds an optional `explanation_video_url` column so an admin can attach a
-- YouTube video to a question's explanation; students watch it embedded in the
-- app wherever the written explanation appears.
--
-- The column is deliberately NOT added to the `authenticated` column-level
-- select grant (secure.sql), so it stays hidden from direct client reads and is
-- delivered ONLY through the SECURITY DEFINER RPCs below — exactly like
-- `explanation`. It unlocks with the explanation (>= 25% attendance gate) on the
-- graded paths, and is fully revealed to admins and on saved bookmarks
-- (get_bookmarks / admin_list_questions already `select *`, so they pick it up
-- automatically — no change needed there).
--
-- Self-contained + idempotent: safe to run on its own via
--   node server/run-migration.mjs supabase/explanation_video.sql
-- (Do NOT rely on the default no-arg runner — it re-runs the whole secure.sql.)
-- The three functions below are copied verbatim from admin_write.sql / secure.sql
-- with only the new column added; keep them in sync with those canonical files.
-- ============================================================================

alter table public.questions
  add column if not exists explanation_video_url text;

-- ─── admin_upsert_question: persist explanation_video_url ────────────────────
create or replace function public.admin_upsert_question(p jsonb)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.questions;
  v_id  uuid := nullif(p->>'id', '')::uuid;
  v_why jsonb := case
    when p->'why_wrong' is null
      or p->'why_wrong' = 'null'::jsonb
      or p->'why_wrong' = '{}'::jsonb
    then null else p->'why_wrong'
  end;
  v_why_ta jsonb := case
    when p->'why_wrong_ta' is null
      or p->'why_wrong_ta' = 'null'::jsonb
      or p->'why_wrong_ta' = '{}'::jsonb
    then null else p->'why_wrong_ta'
  end;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if v_id is null then
    insert into public.questions (
      category, group_type, year, standard,
      ca_month, ca_year, ca_type, ca_topic,
      aptitude_type, aptitude_topic, subject, unit, topic,
      question_type, external_id,
      question_text, option_a, option_b, option_c, option_d,
      correct_answer, explanation, explanation_video_url, why_wrong, why_wrong_ta,
      difficulty, source_url,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
      explanation_ta
    ) values (
      p->>'category',
      nullif(p->>'group_type', ''),
      nullif(p->>'year', '')::int,
      nullif(p->>'standard', '')::int,
      nullif(p->>'ca_month', ''),
      nullif(p->>'ca_year', '')::int,
      nullif(p->>'ca_type', ''),
      nullif(p->>'ca_topic', ''),
      nullif(p->>'aptitude_type', ''),
      nullif(p->>'aptitude_topic', ''),
      nullif(p->>'subject', ''),
      nullif(p->>'unit', ''),
      nullif(p->>'topic', ''),
      nullif(p->>'question_type', ''),
      nullif(p->>'external_id', ''),
      p->>'question_text',
      p->>'option_a', p->>'option_b', p->>'option_c', p->>'option_d',
      p->>'correct_answer',
      nullif(p->>'explanation', ''),
      nullif(p->>'explanation_video_url', ''),
      v_why,
      v_why_ta,
      coalesce(nullif(p->>'difficulty', ''), 'medium'),
      nullif(p->>'source_url', ''),
      nullif(p->>'question_text_ta', ''),
      nullif(p->>'option_a_ta', ''), nullif(p->>'option_b_ta', ''),
      nullif(p->>'option_c_ta', ''), nullif(p->>'option_d_ta', ''),
      nullif(p->>'explanation_ta', '')
    )
    returning * into v_row;
  else
    update public.questions set
      category        = p->>'category',
      group_type      = nullif(p->>'group_type', ''),
      year            = nullif(p->>'year', '')::int,
      standard        = nullif(p->>'standard', '')::int,
      ca_month        = nullif(p->>'ca_month', ''),
      ca_year         = nullif(p->>'ca_year', '')::int,
      ca_type         = nullif(p->>'ca_type', ''),
      ca_topic        = nullif(p->>'ca_topic', ''),
      aptitude_type   = nullif(p->>'aptitude_type', ''),
      aptitude_topic  = nullif(p->>'aptitude_topic', ''),
      subject         = nullif(p->>'subject', ''),
      unit            = nullif(p->>'unit', ''),
      topic           = nullif(p->>'topic', ''),
      question_type   = nullif(p->>'question_type', ''),
      external_id     = nullif(p->>'external_id', ''),
      question_text   = p->>'question_text',
      option_a        = p->>'option_a',
      option_b        = p->>'option_b',
      option_c        = p->>'option_c',
      option_d        = p->>'option_d',
      correct_answer  = p->>'correct_answer',
      explanation     = nullif(p->>'explanation', ''),
      explanation_video_url = nullif(p->>'explanation_video_url', ''),
      why_wrong       = v_why,
      why_wrong_ta    = v_why_ta,
      difficulty      = coalesce(nullif(p->>'difficulty', ''), 'medium'),
      source_url      = nullif(p->>'source_url', ''),
      question_text_ta = nullif(p->>'question_text_ta', ''),
      option_a_ta     = nullif(p->>'option_a_ta', ''),
      option_b_ta     = nullif(p->>'option_b_ta', ''),
      option_c_ta     = nullif(p->>'option_c_ta', ''),
      option_d_ta     = nullif(p->>'option_d_ta', ''),
      explanation_ta  = nullif(p->>'explanation_ta', '')
    where id = v_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'question % not found', v_id;
    end if;
  end if;

  return v_row;
end;
$$;

-- ─── submit_test: reveal explanation_video_url with the explanation ──────────
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

-- ─── grade_review: reveal explanation_video_url after answering ─────────────
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
  v_explanation_video_url text;
  v_interval int;
  intervals int[] := array[1, 3, 7, 16, 35, 75];
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select question_id, reps into v_qid, v_reps
  from public.review_items
  where id = p_item_id and user_id = v_user;
  if v_qid is null then raise exception 'review item not found'; end if;

  select (p_selected = correct_answer), correct_answer, explanation, explanation_ta,
         explanation_video_url
  into v_correct, v_answer, v_explanation, v_explanation_ta, v_explanation_video_url
  from public.questions where id = v_qid;

  if v_correct then
    v_interval := intervals[least(v_reps, array_length(intervals, 1) - 1) + 1];
    v_reps := v_reps + 1;
  else
    v_interval := 0;
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
    'explanation_ta', v_explanation_ta,
    'explanation_video_url', v_explanation_video_url
  );
end;
$$;

grant execute on function public.admin_upsert_question(jsonb)     to authenticated;
grant execute on function public.submit_test(jsonb, jsonb)        to authenticated;
grant execute on function public.grade_review(uuid, text)         to authenticated;
