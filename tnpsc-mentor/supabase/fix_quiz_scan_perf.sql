-- Fix: count_quiz_questions / get_quiz_questions were doing a full sequential
-- scan of the whole `questions` table (~12,000 buffer pages) on EVERY call,
-- regardless of the category/subject/topic filters requested — confirmed via
-- EXPLAIN (ANALYZE, BUFFERS): every filter combination touched the same ~12k
-- pages, vs. the 40-7000 pages an index scan should need. Both were LANGUAGE
-- SQL functions building the WHERE clause from a `WITH cfg AS (...)` CTE of
-- computed columns; Postgres could not push the filters down into an index
-- scan through that shape when called as a function (confirmed: the identical
-- SQL run ad-hoc/PREPARE'd DOES use the index — only the function-wrapped call
-- didn't). Rewritten as PL/pgSQL building the WHERE clause as literal-bound
-- dynamic SQL (via format(%L)), which gets a fresh, index-aware plan per call.
--
-- This was the root cause of recurring "[db error] 57014 canceling statement
-- due to statement timeout" on /api/questions/count and quiz/test starts
-- (332 network/db timeout log lines between 2026-08-16 and 2026-08-22): every
-- call paid full-table-scan cost, which occasionally stacked with normal
-- latency variance and crossed Supabase's statement_timeout under concurrent
-- load.
--
-- Verified before deploy: identical results across 15+ configs (including
-- exclude_ids, mock/scopeToCategory, empty/no-match configs) via exact
-- candidate-row-id-set comparison against the previous functions, plus
-- EXPLAIN showing real index usage (idx_questions_category and friends).

create or replace function public.count_quiz_questions(p_config jsonb)
returns integer
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_category       text    := p_config->>'category';
  v_subject        text    := p_config->>'subject';
  v_standard       int     := (p_config->>'standard')::int;
  v_topic          text    := p_config->>'topic';
  v_unit           text    := p_config->>'unit';
  v_question_type  text    := p_config->>'question_type';
  v_ca_type        text    := p_config->>'ca_type';
  v_ca_month       text    := p_config->>'ca_month';
  v_ca_topic       text    := p_config->>'ca_topic';
  v_aptitude_type  text    := p_config->>'aptitude_type';
  v_aptitude_topic text    := p_config->>'aptitude_topic';
  v_year           int     := (p_config->>'year')::int;
  v_mock           boolean := coalesce((p_config->>'mock')::boolean, false);
  v_scope          boolean := coalesce((p_config->>'scopeToCategory')::boolean, false);
  v_sql            text;
  v_count          integer;
begin
  v_sql := format(
    'select count(*)::int from public.questions q where q.active
       and (q.category <> ''outer'' or %L = ''outer'')
       and q.category not in (''mock'',''testseries'',''vettri'',''testseries_g2'')',
    v_category
  );

  if v_mock then
    if v_scope then
      v_sql := v_sql || format(' and q.category = %L', v_category);
    end if;
  else
    v_sql := v_sql || format(' and q.category = %L', v_category);
    if v_subject        is not null then v_sql := v_sql || format(' and q.subject = %L', v_subject); end if;
    if v_standard        is not null then v_sql := v_sql || format(' and q.standard = %L', v_standard); end if;
    if v_topic           is not null then v_sql := v_sql || format(' and q.topic = %L', v_topic); end if;
    if v_unit            is not null then v_sql := v_sql || format(' and q.unit = %L', v_unit); end if;
    if v_question_type   is not null then v_sql := v_sql || format(' and q.question_type = %L', v_question_type); end if;
    if v_ca_type         is not null then v_sql := v_sql || format(' and q.ca_type = %L', v_ca_type); end if;
    if v_ca_month        is not null then v_sql := v_sql || format(' and q.ca_month = %L', v_ca_month); end if;
    if v_ca_topic        is not null then v_sql := v_sql || format(' and q.ca_topic = %L', v_ca_topic); end if;
    if v_aptitude_type   is not null then v_sql := v_sql || format(' and q.aptitude_type = %L', v_aptitude_type); end if;
    if v_aptitude_topic  is not null then v_sql := v_sql || format(' and q.aptitude_topic = %L', v_aptitude_topic); end if;
    if v_year            is not null then v_sql := v_sql || format(' and q.year = %L', v_year); end if;
  end if;

  execute v_sql into v_count;
  return v_count;
end;
$function$;

create or replace function public.get_quiz_questions(p_config jsonb)
returns table(id uuid, category text, group_type text, year integer, standard integer, ca_month text, ca_year integer, ca_type text, ca_topic text, aptitude_type text, aptitude_topic text, subject text, topic text, question_type text, external_id text, question_text text, option_a text, option_b text, option_c text, option_d text, difficulty text, images jsonb, source_tag text, question_text_ta text, option_a_ta text, option_b_ta text, option_c_ta text, option_d_ta text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_category       text    := p_config->>'category';
  v_subject        text    := p_config->>'subject';
  v_standard       int     := (p_config->>'standard')::int;
  v_topic          text    := p_config->>'topic';
  v_unit           text    := p_config->>'unit';
  v_question_type  text    := p_config->>'question_type';
  v_ca_type        text    := p_config->>'ca_type';
  v_ca_month       text    := p_config->>'ca_month';
  v_ca_topic       text    := p_config->>'ca_topic';
  v_aptitude_type  text    := p_config->>'aptitude_type';
  v_aptitude_topic text    := p_config->>'aptitude_topic';
  v_year           int     := (p_config->>'year')::int;
  v_mock           boolean := coalesce((p_config->>'mock')::boolean, false);
  v_scope          boolean := coalesce((p_config->>'scopeToCategory')::boolean, false);
  v_exclude_ids    uuid[]  := case when p_config ? 'exclude_ids'
                                 then array(select (jsonb_array_elements_text(p_config->'exclude_ids'))::uuid)
                                 else null end;
  v_lim            int     := greatest(coalesce((p_config->>'limit')::int, 100), 1);
  v_where          text;
  v_sql            text;
begin
  v_where := format(
    'q.active
       and (q.category <> ''outer'' or %L = ''outer'')
       and q.category not in (''mock'',''testseries'',''vettri'',''testseries_g2'')',
    v_category
  );

  if v_mock then
    if v_scope then
      v_where := v_where || format(' and q.category = %L', v_category);
    end if;
  else
    v_where := v_where || format(' and q.category = %L', v_category);
    if v_subject        is not null then v_where := v_where || format(' and q.subject = %L', v_subject); end if;
    if v_standard        is not null then v_where := v_where || format(' and q.standard = %L', v_standard); end if;
    if v_topic           is not null then v_where := v_where || format(' and q.topic = %L', v_topic); end if;
    if v_unit            is not null then v_where := v_where || format(' and q.unit = %L', v_unit); end if;
    if v_question_type   is not null then v_where := v_where || format(' and q.question_type = %L', v_question_type); end if;
    if v_ca_type         is not null then v_where := v_where || format(' and q.ca_type = %L', v_ca_type); end if;
    if v_ca_month        is not null then v_where := v_where || format(' and q.ca_month = %L', v_ca_month); end if;
    if v_ca_topic        is not null then v_where := v_where || format(' and q.ca_topic = %L', v_ca_topic); end if;
    if v_aptitude_type   is not null then v_where := v_where || format(' and q.aptitude_type = %L', v_aptitude_type); end if;
    if v_aptitude_topic  is not null then v_where := v_where || format(' and q.aptitude_topic = %L', v_aptitude_topic); end if;
    if v_year            is not null then v_where := v_where || format(' and q.year = %L', v_year); end if;
  end if;

  v_sql := format(
    'select q.id, q.category, q.group_type, q.year, q.standard,
            q.ca_month, q.ca_year, q.ca_type, q.ca_topic,
            q.aptitude_type, q.aptitude_topic, q.subject, q.topic,
            q.question_type, q.external_id,
            q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
            q.difficulty, q.images, q.source_tag,
            q.question_text_ta, q.option_a_ta, q.option_b_ta,
            q.option_c_ta, q.option_d_ta
     from public.questions q
     left join public.seen_questions sq
       on sq.question_id = q.id and sq.user_id = auth.uid()
     where %s %s
     order by (sq.question_id is not null), sq.seen_at asc nulls first, random()
     limit %L',
    v_where,
    case when v_exclude_ids is not null and array_length(v_exclude_ids, 1) > 0
      then ' and not (q.id = any($1))' else '' end,
    v_lim
  );

  if v_exclude_ids is not null and array_length(v_exclude_ids, 1) > 0 then
    return query execute v_sql using v_exclude_ids;
  else
    return query execute v_sql;
  end if;
end;
$function$;
