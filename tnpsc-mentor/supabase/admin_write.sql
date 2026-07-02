-- ============================================================================
-- TNPSC Mentors — Admin question-editor write RPCs
-- ----------------------------------------------------------------------------
-- Run this AFTER schema.sql and secure.sql. It adds the only two write paths
-- the in-app Admin question editor uses. Both are SECURITY DEFINER and gated by
-- is_admin(), mirroring admin_list_questions — so the client never writes to the
-- `questions` table directly and non-admins are rejected server-side.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ─── Upsert (insert when id is absent/empty, else update) ───────────────────
-- `p` is a JSON object with the question fields. Empty strings are normalised to
-- NULL so optional metadata/Tamil columns stay clean. The full row (incl. the
-- answer columns) is returned so the editor can refresh its local copy.
create or replace function public.admin_upsert_question(p jsonb)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.questions;
  v_id  uuid := nullif(p->>'id', '')::uuid;
  -- why_wrong: accept a jsonb object, treat missing / json-null / {} as NULL.
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

-- ─── Delete ─────────────────────────────────────────────────────────────────
create or replace function public.admin_delete_question(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.questions where id = p_id;
end;
$$;

-- ─── Bulk insert (for the in-app importer) ──────────────────────────────────
-- `p` is a JSON ARRAY of question objects. Inserts them all in one statement
-- (all-or-nothing — a single bad row rolls back the batch, so validate client-
-- side first). Every row is stamped source_url = 'tnpsc-official' unless it
-- carries its own source_url, which lets reset_questions.sql purge the old mock
-- bank surgically. Returns { inserted: <count> }.
create or replace function public.admin_bulk_insert_questions(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    question_text, option_a, option_b, option_c, option_d,
    correct_answer, explanation, why_wrong, why_wrong_ta, difficulty, source_url,
    question_text_ta, option_a_ta, option_b_ta, option_c_ta, option_d_ta,
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
    -- Accept qid (source JSON field) or external_id (normalised column name).
    coalesce(nullif(e->>'external_id', ''), nullif(e->>'qid', '')),
    e->>'question_text',
    e->>'option_a', e->>'option_b', e->>'option_c', e->>'option_d',
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
    nullif(e->>'option_c_ta', ''), nullif(e->>'option_d_ta', ''),
    nullif(e->>'explanation_ta', '')
  from jsonb_array_elements(p) as e;

  get diagnostics v_count = row_count;
  return jsonb_build_object('inserted', v_count);
end;
$$;

-- ─── Execute grants ─────────────────────────────────────────────────────────
grant execute on function public.admin_upsert_question(jsonb)        to authenticated;
grant execute on function public.admin_delete_question(uuid)         to authenticated;
grant execute on function public.admin_bulk_insert_questions(jsonb)  to authenticated;
