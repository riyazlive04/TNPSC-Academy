-- ─── Mock-test sampling RPCs ────────────────────────────────────────────────
-- These were defined in secure.sql but never applied to the live DB, so both
-- mock endpoints fell back to a slow multi-query JS path (group mock ~10s, which
-- reads as an endless loading spinner after entering full-screen). Applying them
-- moves the random sampling server-side (ORDER BY random + limit), cutting the
-- group mock to well under a second. Re-runnable (create or replace).
--
-- Source of truth: supabase/secure.sql (3i). Kept identical here.

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
  where q.category = 'subject' and q.active
    and (p_subject    is null or q.subject    = p_subject)
    and (p_topic      is null or q.topic      = p_topic)
    and (p_difficulty is null or q.difficulty = p_difficulty)
  order by random()
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
  where q.active
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
  order by random()
  limit greatest(coalesce(p_count, 0), 0);
$$;

grant execute on function public.subject_mock_questions(text, text, text, int) to authenticated;
grant execute on function public.mock_slot_questions(jsonb, int) to authenticated;
