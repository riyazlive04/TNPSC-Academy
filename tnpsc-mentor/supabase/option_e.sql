-- ============================================================================
-- TNPSC Mentors — 5th answer option (E) support
-- ----------------------------------------------------------------------------
-- Adds questions.option_e / option_e_ta so 5-option items (the IndiaBix analogy
-- reasoning bank) can be stored and served. Every existing 4-option row keeps
-- option_e = NULL; the client's optionLetters(q) helper only renders E when the
-- row actually has it, so 4-option questions are unaffected.
--
-- Bodies below are reproduced from the LIVE function definitions (pg_get_functiondef)
-- with ONLY option_e / option_e_ta added to the RETURNS TABLE shape + select list.
-- CREATE OR REPLACE cannot widen a RETURNS TABLE, so the four read RPCs are
-- dropped first (mirrors the existing run-migration.mjs pattern).
--
-- Run LAST (after secure.sql / active_flag.sql / seen_questions.sql / mock_rpcs.sql),
-- since those files redefine the same functions in their pre-E shape:
--   node run-migration.mjs ../supabase/option_e.sql
-- Re-runnable / idempotent.
-- ============================================================================

begin;

-- ─── 1. Columns ─────────────────────────────────────────────────────────────
alter table public.questions add column if not exists option_e    text;
alter table public.questions add column if not exists option_e_ta text;

-- ─── 2. Drop read RPCs whose RETURNS TABLE shape changes ────────────────────
drop function if exists public.get_quiz_questions(jsonb);
drop function if exists public.get_due_reviews(int);
drop function if exists public.subject_mock_questions(text, text, text, int);
drop function if exists public.mock_slot_questions(jsonb, int);

-- ─── 3. get_quiz_questions (+ option_e / option_e_ta) ───────────────────────
create or replace function public.get_quiz_questions(p_config jsonb)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text, option_e text,
  difficulty text, images jsonb,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text, option_e_ta text
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
      case when p_config ? 'exclude_ids'
        then array(select (jsonb_array_elements_text(p_config->'exclude_ids'))::uuid)
        else null end                                  as exclude_ids,
      greatest(coalesce((p_config->>'limit')::int, 100), 1)    as lim
  )
  select q.id, q.category, q.group_type, q.year, q.standard,
         q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
         q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
         q.question_type, q.external_id,
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta, q.option_e_ta
  from public.questions q
  cross join cfg
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
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
    and (cfg.exclude_ids is null or not (q.id = any(cfg.exclude_ids)))
  order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
  limit (select lim from cfg);
$$;

-- ─── 4. get_due_reviews (+ option_e / option_e_ta) ──────────────────────────
create or replace function public.get_due_reviews(p_limit int default 30)
returns table (
  item_id uuid, reps int, interval_days int, due_at timestamptz, last_result text,
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text, option_e text,
  difficulty text, images jsonb,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text, option_e_ta text
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
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta, q.option_e_ta
  from public.review_items r
  join public.questions q on q.id = r.question_id
  where r.user_id = auth.uid()
    and r.due_at <= now()
    and q.active
  order by r.due_at asc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

-- ─── 5. subject_mock_questions (+ option_e / option_e_ta) ───────────────────
create or replace function public.subject_mock_questions(p_subject text, p_topic text, p_difficulty text, p_count integer)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text, option_e text,
  difficulty text, images jsonb,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text, option_e_ta text
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
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta, q.option_e_ta
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

-- ─── 6. mock_slot_questions (+ option_e / option_e_ta) ──────────────────────
create or replace function public.mock_slot_questions(p_queries jsonb, p_count int)
returns table (
  id uuid, category text, group_type text, year integer, standard integer,
  ca_month text, ca_year integer, ca_type text, ca_topic text,
  aptitude_type text, aptitude_topic text, subject text, topic text,
  question_type text, external_id text,
  question_text text, option_a text, option_b text, option_c text, option_d text, option_e text,
  difficulty text, images jsonb,
  question_text_ta text, option_a_ta text, option_b_ta text,
  option_c_ta text, option_d_ta text, option_e_ta text
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
         q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
         q.difficulty, q.images,
         q.question_text_ta, q.option_a_ta, q.option_b_ta,
         q.option_c_ta, q.option_d_ta, q.option_e_ta
  from public.questions q
  left join public.seen_questions sq
    on sq.question_id = q.id and sq.user_id = auth.uid()
  where q.active
    and exists (
      select 1
      from jsonb_array_elements(p_queries) elem
      where q.category = elem->>'category'
        and (
          jsonb_typeof(elem->'subjects') is distinct from 'array'
          or q.subject = any (
            select jsonb_array_elements_text(elem->'subjects')
          )
        )
    )
  order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
  limit greatest(coalesce(p_count, 0), 0);
$$;

-- ─── 7. Grants (lost on DROP) ───────────────────────────────────────────────
grant execute on function public.get_quiz_questions(jsonb)                       to authenticated;
grant execute on function public.get_due_reviews(int)                            to authenticated;
grant execute on function public.subject_mock_questions(text, text, text, int)   to authenticated;
grant execute on function public.mock_slot_questions(jsonb, int)                 to authenticated;

-- ─── 8. Admin write RPCs: persist option_e / option_e_ta ────────────────────
-- Return types are unchanged (questions / jsonb), so CREATE OR REPLACE is fine.
create or replace function public.admin_upsert_question(p jsonb)
returns questions
language plpgsql
security definer
set search_path = public
as $function$
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
      question_text, option_a, option_b, option_c, option_d, option_e,
      correct_answer, explanation, why_wrong, why_wrong_ta, difficulty, source_url,
      question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta, option_e_ta,
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
      p->>'option_a', p->>'option_b', p->>'option_c', p->>'option_d', nullif(p->>'option_e', ''),
      p->>'correct_answer',
      nullif(p->>'explanation', ''),
      v_why,
      v_why_ta,
      coalesce(nullif(p->>'difficulty', ''), 'medium'),
      nullif(p->>'source_url', ''),
      nullif(p->>'question_text_ta', ''),
      nullif(p->>'option_a_ta', ''), nullif(p->>'option_b_ta', ''),
      nullif(p->>'option_c_ta', ''), nullif(p->>'option_d_ta', ''), nullif(p->>'option_e_ta', ''),
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
      option_e        = nullif(p->>'option_e', ''),
      correct_answer  = p->>'correct_answer',
      explanation     = nullif(p->>'explanation', ''),
      why_wrong       = v_why,
      why_wrong_ta    = v_why_ta,
      difficulty      = coalesce(nullif(p->>'difficulty', ''), 'medium'),
      source_url      = nullif(p->>'source_url', ''),
      question_text_ta = nullif(p->>'question_text_ta', ''),
      option_a_ta     = nullif(p->>'option_a_ta', ''),
      option_b_ta     = nullif(p->>'option_b_ta', ''),
      option_c_ta     = nullif(p->>'option_c_ta', ''),
      option_d_ta     = nullif(p->>'option_d_ta', ''),
      option_e_ta     = nullif(p->>'option_e_ta', ''),
      explanation_ta  = nullif(p->>'explanation_ta', '')
    where id = v_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'question % not found', v_id;
    end if;
  end if;

  return v_row;
end;
$function$;

create or replace function public.admin_bulk_insert_questions(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  insert into public.questions (
    category, group_type, year, standard, ca_month, ca_year, ca_type, ca_topic,
    aptitude_type, aptitude_topic, subject, unit, topic,
    question_type, external_id,
    question_text, option_a, option_b, option_c, option_d, option_e,
    correct_answer, explanation, why_wrong, why_wrong_ta, difficulty, source_url,
    question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta, option_e_ta,
    explanation_ta
  )
  select
    e->>'category',
    nullif(e->>'group_type', ''),
    nullif(e->>'year', '')::int,
    nullif(e->>'standard', '')::int,
    nullif(e->>'ca_month', ''),
    nullif(e->>'ca_year', '')::int,
    nullif(e->>'ca_type', ''),
    nullif(e->>'ca_topic', ''),
    nullif(e->>'aptitude_type', ''),
    nullif(e->>'aptitude_topic', ''),
    nullif(e->>'subject', ''),
    nullif(e->>'unit', ''),
    nullif(e->>'topic', ''),
    nullif(e->>'question_type', ''),
    coalesce(nullif(e->>'external_id', ''), nullif(e->>'qid', '')),
    e->>'question_text',
    e->>'option_a', e->>'option_b', e->>'option_c', e->>'option_d', nullif(e->>'option_e', ''),
    upper(e->>'correct_answer'),
    nullif(e->>'explanation', ''),
    case
      when e->'why_wrong' is null
        or e->'why_wrong' = 'null'::jsonb
        or e->'why_wrong' = '{}'::jsonb
      then null else e->'why_wrong'
    end,
    case
      when e->'why_wrong_ta' is null
        or e->'why_wrong_ta' = 'null'::jsonb
        or e->'why_wrong_ta' = '{}'::jsonb
      then null else e->'why_wrong_ta'
    end,
    coalesce(nullif(e->>'difficulty', ''), 'medium'),
    coalesce(nullif(e->>'source_url', ''), 'tnpsc-official'),
    nullif(e->>'question_text_ta', ''),
    nullif(e->>'option_a_ta', ''), nullif(e->>'option_b_ta', ''),
    nullif(e->>'option_c_ta', ''), nullif(e->>'option_d_ta', ''), nullif(e->>'option_e_ta', ''),
    nullif(e->>'explanation_ta', '')
  from jsonb_array_elements(p) as e;

  get diagnostics v_count = row_count;
  return jsonb_build_object('inserted', v_count);
end;
$function$;

commit;
