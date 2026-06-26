-- ============================================================================
-- TNPSC Mentors — Group 2 / 2A Previous-Year Questions (category='pyq2')
-- ----------------------------------------------------------------------------
-- A second, self-contained PYQ bank for the Group 2/2A exams, kept apart from
-- the Group 1 subject-membership bank (category='pyq') so neither the Group 1
-- pickers nor the group-exam mock slots (which pull category='pyq') are touched.
--
-- Shape of a pyq2 row:
--   subject = the SECTION  : 'Aptitude' | 'English' | 'Tamil' | 'General Studies'
--   topic   = the SUB-TYPE : English/Tamil skill area, or a GS subject name
--   aptitude_type          : 'numerics' | 'reasoning'  (Aptitude section only)
--   year                   : exam year (shown as a badge + drives the year filter)
--
-- The Group 2 pickers reuse the existing get_quiz_questions / count_quiz_questions
-- / question_topic_counts RPCs via category+subject+topic+aptitude_type. The only
-- new capability needed is a YEAR filter, added to all three below.
--
-- Idempotent: safe to re-run. Run with:
--   node run-migration.mjs ../supabase/pyq2.sql
-- ============================================================================

-- ─── 1. Allow category = 'pyq2' (keep every existing value or rows break) ────
alter table public.questions drop constraint if exists questions_category_check;
alter table public.questions add constraint questions_category_check
  check (category in (
    'pyq', 'samacheer', 'current_affairs', 'aptitude', 'outer', 'subject', 'mock', 'pyq2'
  ));

-- ─── 2. Quiz sampler with a year filter (supersedes the live definition) ─────
-- Identical to the live get_quiz_questions (unseen-first ordering + exclude_ids)
-- with one added optional filter: cfg.year. When the config omits `year` the
-- clause is a no-op, so every existing caller behaves exactly as before.
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
      (p_config->>'year')::int                         as year,
      coalesce((p_config->>'mock')::boolean, false)    as mock,
      coalesce((p_config->>'scopeToCategory')::boolean, false) as scope_to_category,
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
    and (q.category <> 'outer' or cfg.category = 'outer')
    and q.category <> 'mock'
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
    and (cfg.mock or cfg.year           is null or q.year           = cfg.year)
    and (cfg.exclude_ids is null or not (q.id = any(cfg.exclude_ids)))
  order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
  limit (select lim from cfg);
$$;

-- ─── 3. Count with the same year filter ─────────────────────────────────────
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
      (p_config->>'year')::int                         as year,
      coalesce((p_config->>'mock')::boolean, false)    as mock,
      coalesce((p_config->>'scopeToCategory')::boolean, false) as scope_to_category
  )
  select count(*)::int
  from public.questions q, cfg
  where
    q.active
    and (q.category <> 'outer' or cfg.category = 'outer')
    and q.category <> 'mock'
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
    and (cfg.mock or cfg.year           is null or q.year           = cfg.year);
$$;

-- ─── 4. Per-topic counts with an optional year filter ───────────────────────
-- Adds cfg.year (a no-op when omitted) so the Group 2 section pages can show a
-- live per-sub-type count for the selected exam year.
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
      p_config->>'aptitude_type'   as aptitude_type,
      (p_config->>'year')::int     as year
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
      and (cfg.category in ('samacheer', 'current_affairs') or q.active)
      and (cfg.subject is null or q.subject = cfg.subject)
      and (cfg.standard is null or q.standard = cfg.standard)
      and (cfg.aptitude_type is null or cfg.category <> 'aptitude'
            or q.aptitude_type = cfg.aptitude_type)
      and (cfg.year is null or q.year = cfg.year)
  ) s
  where t is not null
  group by t;
$$;

-- ─── 5. Admin bank: respect the year filter too (mirrors the student scope) ──
-- Same body as admin_list_filters.sql with one added optional clause: year. A
-- no-op when the config omits `year`, so every existing admin view is unchanged.
create or replace function public.admin_list_questions(p_config jsonb)
returns setof public.questions
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;
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
    and ((p_config->>'year')         is null or q.year           = (p_config->>'year')::int)
  order by q.created_at desc
  limit 500;
end;
$$;

grant execute on function public.get_quiz_questions(jsonb)     to authenticated;
grant execute on function public.count_quiz_questions(jsonb)   to authenticated;
grant execute on function public.question_topic_counts(jsonb)  to authenticated;
grant execute on function public.admin_list_questions(jsonb)   to authenticated;
