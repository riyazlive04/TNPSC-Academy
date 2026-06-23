-- ============================================================================
-- TNPSC Mentors — History period filter (ancient / medieval / modern)
-- ----------------------------------------------------------------------------
-- The PYQ History bank (category='pyq', subject='History and INM') is tagged
-- with a historical PERIOD in `questions.unit` (see server/load-history-periods
-- .mjs). The History test selector lets a student pick Ancient / Medieval /
-- Modern, which flows through as config.unit. Teach get_quiz_questions (and the
-- admin bank view) to filter on `unit` so the test only pulls that period.
--
-- The filter is a no-op for every other flow: only the History selector ever
-- sends `unit`, and when it's absent the clause matches all rows.
--
-- Re-run AFTER active_flag.sql / admin_list_filters.sql (this supersedes both
-- function bodies). Idempotent.
-- ============================================================================

-- ─── get_quiz_questions: add the unit (period) filter ───────────────────────
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
    and (cfg.mock or cfg.aptitude_topic is null or q.aptitude_topic = cfg.aptitude_topic)
  order by random()
  limit (select lim from cfg);
$$;

-- ─── admin_list_questions: mirror the unit filter for the admin bank view ───
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
  where q.active
    and (p_config->>'category'       is null or q.category       = p_config->>'category')
    and (p_config->>'group_type'     is null or q.category = 'pyq' or q.group_type = p_config->>'group_type')
    and (p_config->>'subject'        is null or q.subject        = p_config->>'subject')
    and ((p_config->>'standard')     is null or q.standard       = (p_config->>'standard')::int)
    and (p_config->>'topic'          is null or q.topic          = p_config->>'topic')
    and (p_config->>'unit'           is null or q.unit           = p_config->>'unit')
    and (p_config->>'question_type'  is null or q.question_type  = p_config->>'question_type')
    and (p_config->>'ca_type'        is null or q.ca_type        = p_config->>'ca_type')
    and (p_config->>'ca_month'       is null or q.ca_month       = p_config->>'ca_month')
    and (p_config->>'ca_topic'       is null or q.ca_topic       = p_config->>'ca_topic')
    and (p_config->>'aptitude_type'  is null or q.aptitude_type  = p_config->>'aptitude_type')
    and (p_config->>'aptitude_topic' is null or q.aptitude_topic = p_config->>'aptitude_topic')
  order by q.created_at desc
  limit 500;
end;
$$;

grant execute on function public.get_quiz_questions(jsonb)  to authenticated;
grant execute on function public.admin_list_questions(jsonb) to authenticated;
