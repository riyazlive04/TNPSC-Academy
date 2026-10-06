-- PYQ "Full Paper": sit a whole previous-year paper, in the order it was
-- printed, instead of a random sample of one subject or section.
--
-- Everything the feature needs already exists except the ORDER BY. The banks
-- are filtered by category + year (count_quiz_questions already does that
-- unchanged), and the paper's question number is recoverable from external_id,
-- which every PYQ importer writes with the number last:
--
--   pyq   `pyq-<subjectSlug>-<year>_Q<n>`    import_pyq.mjs      (Group 1)
--   pyq2  `pyq2-<paper>-<year>-<CODE>-<q_no>` import_pyq2.mjs     (Group 2 / 2A)
--   pyq4  `pyq4-<year>-<qnum>`               import_pyq4.mjs     (Group 4 / VAO)
--
-- Group 1 and Group 4 number a year's questions once across the whole paper, so
-- the trailing number alone rebuilds the paper exactly. Group 2 numbers each
-- paper from 1 ('gs' / 'ta' / 'en' — the General Studies paper and the two
-- language papers), so those are ranked first, in sitting order, and the
-- question number orders within each.
--
-- The number is compared as ZERO-PADDED TEXT rather than cast to int on
-- purpose: a cast is an error waiting for the first external_id that happens to
-- end in a long digit run, and this sort runs inside a SECURITY DEFINER
-- function serving every practice test in the app. lpad() cannot fail.
--
-- An external_id with no trailing number (or none at all) sorts last rather
-- than breaking the draw, with external_id as a stable tie-break so a paper
-- never comes back in a different order twice.
--
-- Unchanged from supabase/fix_quiz_scan_perf.sql (the current definition) apart
-- from the paperOrder branch: the WHERE clause is still built as literal-bound
-- dynamic SQL so each call gets an index-aware plan. Read that file's header
-- before touching the filters here.
--
-- count_quiz_questions is NOT redefined — it needs no change.

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
  -- Full-paper draw: printed order, not an unseen-first random sample.
  v_paper          boolean := coalesce((p_config->>'paperOrder')::boolean, false);
  v_exclude_ids    uuid[]  := case when p_config ? 'exclude_ids'
                                 then array(select (jsonb_array_elements_text(p_config->'exclude_ids'))::uuid)
                                 else null end;
  v_lim            int     := greatest(coalesce((p_config->>'limit')::int, 100), 1);
  v_where          text;
  v_order          text;
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

  if v_paper then
    -- Printed-paper order. The Group 2 paper rank is a no-op for the other
    -- banks (their segment 2 is a year or a subject slug, so every row scores
    -- the same 4) — it is applied only for pyq2 so no other bank pays for it.
    v_order :=
      case when v_category = 'pyq2'
        then 'order by case split_part(q.external_id, ''-'', 2)'
             || ' when ''gs'' then 1 when ''ta'' then 2 when ''en'' then 3 else 4 end,'
        else 'order by'
      end
      || ' lpad((regexp_match(q.external_id, ''([0-9]+)$''))[1], 10, ''0'')'
      || ' nulls last, q.external_id';
  else
    v_order := 'order by (sq.question_id is not null), sq.seen_at asc nulls first, random()';
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
     %s
     limit %L',
    v_where,
    case when v_exclude_ids is not null and array_length(v_exclude_ids, 1) > 0
      then ' and not (q.id = any($1))' else '' end,
    v_order,
    v_lim
  );

  if v_exclude_ids is not null and array_length(v_exclude_ids, 1) > 0 then
    return query execute v_sql using v_exclude_ids;
  else
    return query execute v_sql;
  end if;
end;
$function$;

grant execute on function public.get_quiz_questions(jsonb) to authenticated;
