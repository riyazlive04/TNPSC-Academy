-- ============================================================================
-- TNPSC Mentor — Soft-hide support (active flag)
-- ----------------------------------------------------------------------------
-- Adds questions.active so rows can be hidden from quizzes/revision without
-- deleting them (preserves test_answers / review_items / history).
--   • active = true  -> visible in tests & spaced revision
--   • active = false -> hidden (admins still see it via admin_list_questions)
-- Re-runnable / idempotent.
-- ============================================================================

alter table public.questions add column if not exists active boolean not null default true;
create index if not exists idx_questions_active on public.questions(active);

-- ─── get_quiz_questions: only serve active rows ─────────────────────────────
create or replace function public.get_quiz_questions(p_config jsonb)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, source_tag text,
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
      p_config->>'question_type'                       as question_type,
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
         q.difficulty, q.source_tag,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.questions q, cfg
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
    and (cfg.mock or cfg.question_type  is null or q.question_type  = cfg.question_type)
    and (cfg.mock or cfg.ca_type        is null or q.ca_type        = cfg.ca_type)
    and (cfg.mock or cfg.ca_month       is null or q.ca_month       = cfg.ca_month)
    and (cfg.mock or cfg.ca_topic       is null or q.ca_topic       = cfg.ca_topic)
    and (cfg.mock or cfg.aptitude_type  is null or q.aptitude_type  = cfg.aptitude_type)
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic)
  order by random()
  limit (select lim from cfg);
$$;

-- ─── get_due_reviews: skip questions that have since been hidden ────────────
create or replace function public.get_due_reviews(p_limit int default 30)
returns table (
  item_id uuid, reps int, interval_days int, due_at timestamptz, last_result text,
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text,
  difficulty text, source_tag text,
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
         q.difficulty, q.source_tag,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta
  from public.review_items r
  join public.questions q on q.id = r.question_id
  where r.user_id = auth.uid()
    and r.due_at <= now()
    and q.active
  order by r.due_at asc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

grant execute on function public.get_quiz_questions(jsonb) to authenticated;
grant execute on function public.get_due_reviews(int)      to authenticated;
