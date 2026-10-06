-- ============================================================================
-- TNPSC Mentors — "Target Group 2 2026" (3rd scheduled test series, ₹849)
-- ----------------------------------------------------------------------------
-- Run AFTER rank_booster.sql + rank_booster_language_tests.sql (needs the
-- multi-series `test_series` catalog, its `tier` column and the
-- superadmin_grant_plan RPC this file recreates).
--
-- The product: a LANGUAGE test series for the Group 2 / 2A prelim, sold in two
-- tracks at ₹849 each — General English or General Tamil. A buyer picks their
-- track by which pay link they are sent, so the track IS the plan they bought
-- ('target_g2_en' / 'target_g2_ta') and needs no state of its own.
--
-- Each track is 13 papers: 10 unit papers in that language (100 Q each) and
-- three 200-Q Grand Mocks built to the real prelim pattern — a General Studies
-- half (100 Q, bilingual) plus that track's language half (100 Q). The GS half
-- is the SAME paper for both tracks, which is why this file introduces
-- `test_series.question_sets`: see section 3.
--
-- Apply with:
--   node --env-file=.env run-migration.mjs ../supabase/target_g2_2026.sql
-- Idempotent / re-runnable.
-- ============================================================================

-- ─── 1. Allow category = 'testseries_g2t' ────────────────────────────────────
-- The live constraint must list EVERY category value already present in the
-- table or the ADD fails validation against existing rows — a footgun this
-- repo has been bitten by twice (see the rank_booster.sql / vettri.sql headers,
-- where the list had to be verified by hand against prod first). Composed from
-- the live data here instead, so it cannot be written stale.
do $cats$
declare
  v_cats text;
begin
  select string_agg(quote_literal(c), ', ' order by c) into v_cats
  from (
    select distinct category as c from public.questions where category is not null
    union
    select unnest(array[
      'pyq', 'pyq2', 'pyq4', 'samacheer', 'current_affairs', 'aptitude',
      'outer', 'subject', 'mock', 'testseries', 'vettri', 'testseries_g2',
      'testseries_g2t'
    ])
  ) s;

  execute 'alter table public.questions drop constraint if exists questions_category_check';
  execute format(
    'alter table public.questions add constraint questions_category_check check (category in (%s))',
    v_cats
  );
end
$cats$;

-- ─── 2. Keep the new bank out of practice quizzes ────────────────────────────
-- get_quiz_questions / count_quiz_questions sample the practice banks and
-- exclude every fixed-paper bank by name. Both bodies below are the CURRENT
-- live definitions reproduced verbatim — get_quiz_questions from
-- supabase/pyq_full_paper.sql (applied 2026-10-06, the newest) and
-- count_quiz_questions from supabase/fix_quiz_scan_perf.sql — with
-- 'testseries_g2t' added to the exclusion list and NOTHING else changed.
-- Do NOT apply the older test_series_leak_guard.sql after this file; it is a
-- stale (pre-vettri, pre-perf-fix, pre-full-paper) snapshot.
--
-- CREATE OR REPLACE cannot widen a RETURNS TABLE, so if the live
-- get_quiz_questions ever differs in SHAPE from the one reproduced here (e.g.
-- option_e / option_e_ta were added to it — supabase/option_e.sql did that
-- once, and the Aug/Oct rewrites have since replaced it without them), this
-- statement raises "cannot change return type of existing function" and the
-- whole file rolls back untouched, because run-migration.mjs sends it as one
-- multi-statement query. The fix is then to dump the live body
-- (pg_get_functiondef) and re-copy it here with the one line added — never to
-- drop the function blind, which would take every practice test down with it.

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
       and q.category not in (''mock'',''testseries'',''vettri'',''testseries_g2'',''testseries_g2t'')',
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
       and q.category not in (''mock'',''testseries'',''vettri'',''testseries_g2'',''testseries_g2t'')',
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
grant execute on function public.count_quiz_questions(jsonb) to authenticated;

-- ─── 3. A catalog paper may be built from MORE THAN ONE question set ─────────
-- Until now a paper was exactly one `questions.test_set` within its series'
-- category, so `test_series.test_set` was both the paper's number and its bank
-- pointer. The Grand Mocks break that: their General Studies half is one bank
-- that BOTH tracks sit, so the English mock is {GS bank, English bank} and the
-- Tamil mock is {the same GS bank, Tamil bank}.
--
-- `question_sets` is that pointer, and NULL keeps the old meaning ([test_set]),
-- so every existing row in every series behaves exactly as before.
-- Duplicating the 300 General Studies rows into a second bank was the
-- alternative; it would have meant a correction to a mock GS question (or a
-- student's question report on one) silently fixing only one of the two copies.
alter table public.test_series add column if not exists question_sets integer[];

comment on column public.test_series.question_sets is
  'Which questions.test_set values inside this series'' category make up the '
  'paper. NULL means the single set named by test_set (the default for every '
  'series that has one bank per paper).';

-- ─── 4. Catalog: 13 English-track + 13 Tamil-track papers ────────────────────
-- Bank layout inside category='testseries_g2t' (see server/load-target-g2.mjs):
--     1..10  English unit papers 1..10
--    11..20  Tamil unit papers 1..10
--    41..43  Grand Mock 1..3 — General Studies half (bilingual, SHARED)
--    44..46  Grand Mock 1..3 — General English half
--    47..49  Grand Mock 1..3 — General Tamil half
--
-- No scheduled_date: every paper is open the moment the series is bought
-- (open_override 'auto' + a NULL date never date-locks). Paper 1 of each track
-- is tier='free', the try-before-you-enrol hook both other series use.
--
-- A Tamil-track row still carries English title/label text and vice versa:
-- those columns are the app's UI language, not the paper's — a Tamil-UI buyer
-- on the English track reads Tamil chrome around an English paper.

insert into public.test_series
  (id, series, test_set, question_sets, title, title_ta, unit_label, unit_label_ta,
   subjects_label, subjects_label_ta,
   total_questions, duration_seconds, scheduled_date, sort_order, tier)
values
  -- ── English track ──────────────────────────────────────────────────────────
  ('g2te1', 'g2_target_en', 1, '{1}', 'Grammar', 'இலக்கணம்',
   'Unit I', 'அலகு I',
   'Grammar — articles, tenses, voice, concord, prepositions, question tags',
   'இலக்கணம் — இடைச்சொல், காலம், வினை, எழுவாய்-பயனிலை, முன்னிடைச்சொல்',
   100, 5400, null, 1, 'free'),
  ('g2te2', 'g2_target_en', 2, '{2}', 'Vocabulary', 'சொல்லகராதி',
   'Unit II', 'அலகு II',
   'Synonyms · Antonyms · Homophones · Idioms & Phrases · Word formation',
   'ஒருபொருள் சொற்கள் · எதிர்ச்சொற்கள் · ஒலியொப்புச் சொற்கள் · மரபுத்தொடர்கள்',
   100, 5400, null, 2, 'paid'),
  ('g2te3', 'g2_target_en', 3, '{3}', 'Writing Skills & Technical Terms', 'எழுதும் திறன் & கலைச் சொற்கள்',
   'Units III & IV', 'அலகு III & IV',
   'Writing Skills (50) · Technical Terms (50)',
   'எழுதும் திறன் (50) · கலைச் சொற்கள் (50)',
   100, 5400, null, 3, 'paid'),
  ('g2te4', 'g2_target_en', 4, '{4}', 'Reading Comprehension & Translation', 'வாசித்தல் & மொழிபெயர்ப்பு',
   'Units V & VI', 'அலகு V & VI',
   'Reading Comprehension (80) · Translation (20)',
   'வாசித்தல் – புரிந்து கொள்ளும் திறன் (80) · எளிய மொழிபெயர்ப்பு (20)',
   100, 5400, null, 4, 'paid'),
  ('g2te5', 'g2_target_en', 5, '{5}', 'Literary Works', 'இலக்கியம்',
   'Unit VII', 'அலகு VII',
   'The 30 prescribed poems and 30 prescribed prose pieces',
   'பாடத்திட்டத்தில் குறிப்பிட்ட 30 கவிதைகள் & 30 உரைநடைப் பகுதிகள்',
   100, 5400, null, 5, 'paid'),
  ('g2te6', 'g2_target_en', 6, '{6}', 'Grammar & Writing Skills', 'இலக்கணம் & எழுதும் திறன்',
   'Units I & III', 'அலகு I & III',
   'Grammar (71) · Writing Skills (29)',
   'இலக்கணம் (71) · எழுதும் திறன் (29)',
   100, 5400, null, 6, 'paid'),
  ('g2te7', 'g2_target_en', 7, '{7}', 'Vocabulary & Technical Terms', 'சொல்லகராதி & கலைச் சொற்கள்',
   'Units II & IV', 'அலகு II & IV',
   'Vocabulary (60) · Technical Terms (40)',
   'சொல்லகராதி (60) · கலைச் சொற்கள் (40)',
   100, 5400, null, 7, 'paid'),
  ('g2te8', 'g2_target_en', 8, '{8}', 'Reading Comprehension & Translation', 'வாசித்தல் & மொழிபெயர்ப்பு',
   'Units V & VI', 'அலகு V & VI',
   'Reading Comprehension (80) · Translation (20)',
   'வாசித்தல் – புரிந்து கொள்ளும் திறன் (80) · எளிய மொழிபெயர்ப்பு (20)',
   100, 5400, null, 8, 'paid'),
  ('g2te9', 'g2_target_en', 9, '{9}', 'Literary Works', 'இலக்கியம்',
   'Unit VII', 'அலகு VII',
   'The 30 prescribed poems and 30 prescribed prose pieces',
   'பாடத்திட்டத்தில் குறிப்பிட்ட 30 கவிதைகள் & 30 உரைநடைப் பகுதிகள்',
   100, 5400, null, 9, 'paid'),
  ('g2te10', 'g2_target_en', 10, '{10}', 'English Full Test (as per syllabus)', 'ஆங்கிலம் முழுத் தேர்வு (பாடத்திட்டப்படி)',
   'Units I–VII', 'அலகு I–VII',
   'Full Part C weighting — 25/15/10/10/20/5/15',
   'முழு பகுதி C வினா விகிதம் — 25/15/10/10/20/5/15',
   100, 5400, null, 10, 'paid'),
  ('g2te11', 'g2_target_en', 11, '{41,44}', 'Grand Mock Test 1', 'முழு மாதிரித் தேர்வு 1',
   'Full Prelim Pattern', 'முழுத் தேர்வு முறை',
   'General Studies (100) + General English (100) — the real 200-Q prelim',
   'பொது அறிவு (100) + பொது ஆங்கிலம் (100) — உண்மையான 200 வினா முதல்நிலைத் தேர்வு',
   200, 10800, null, 11, 'paid'),
  ('g2te12', 'g2_target_en', 12, '{42,45}', 'Grand Mock Test 2', 'முழு மாதிரித் தேர்வு 2',
   'Full Prelim Pattern', 'முழுத் தேர்வு முறை',
   'General Studies (100) + General English (100) — the real 200-Q prelim',
   'பொது அறிவு (100) + பொது ஆங்கிலம் (100) — உண்மையான 200 வினா முதல்நிலைத் தேர்வு',
   200, 10800, null, 12, 'paid'),
  ('g2te13', 'g2_target_en', 13, '{43,46}', 'Grand Mock Test 3', 'முழு மாதிரித் தேர்வு 3',
   'Full Prelim Pattern', 'முழுத் தேர்வு முறை',
   'General Studies (100) + General English (100) — the real 200-Q prelim',
   'பொது அறிவு (100) + பொது ஆங்கிலம் (100) — உண்மையான 200 வினா முதல்நிலைத் தேர்வு',
   200, 10800, null, 13, 'paid'),

  -- ── Tamil track ────────────────────────────────────────────────────────────
  ('g2tt1', 'g2_target_ta', 1, '{11}', 'Unit 1 — Grammar', 'அலகு 1 — இலக்கணம்',
   'Unit I', 'அலகு I',
   'எழுத்து + சொல் இலக்கணம்',
   'எழுத்து + சொல் இலக்கணம்',
   100, 5400, null, 1, 'free'),
  ('g2tt2', 'g2_target_ta', 2, '{12}', 'Unit 2 — Vocabulary', 'அலகு 2 — சொல்லகராதி',
   'Unit II', 'அலகு II',
   'சொல்லகராதி — பொருள் வேறுபாடு, ஒருபொருட் பன்மொழி, எதிர்ச்சொல், மரபுத்தொடர்',
   'சொல்லகராதி — பொருள் வேறுபாடு, ஒருபொருட் பன்மொழி, எதிர்ச்சொல், மரபுத்தொடர்',
   100, 5400, null, 2, 'paid'),
  ('g2tt3', 'g2_target_ta', 3, '{13}', 'Units 3 & 6', 'அலகு 3 & 6',
   'Units III & VI', 'அலகு III & VI',
   'எழுதும் திறன் (75) · எளிய மொழிபெயர்ப்பு (25)',
   'எழுதும் திறன் (75) · எளிய மொழிபெயர்ப்பு (25)',
   100, 5400, null, 3, 'paid'),
  ('g2tt4', 'g2_target_ta', 4, '{14}', 'Units 4 & 5', 'அலகு 4 & 5',
   'Units IV & V', 'அலகு IV & V',
   'கலைச் சொற்கள் (40) · வாசித்தல் – புரிந்து கொள்ளும் திறன் (60)',
   'கலைச் சொற்கள் (40) · வாசித்தல் – புரிந்து கொள்ளும் திறன் (60)',
   100, 5400, null, 4, 'paid'),
  ('g2tt5', 'g2_target_ta', 5, '{15}', 'Unit 7 — Literature', 'அலகு 7 — இலக்கியம்',
   'Unit VII', 'அலகு VII',
   'இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த்தொண்டும்',
   'இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த்தொண்டும்',
   100, 5400, null, 5, 'paid'),
  ('g2tt6', 'g2_target_ta', 6, '{16}', 'Units 1 & 2', 'அலகு 1 & 2',
   'Units I & II', 'அலகு I & II',
   'இலக்கணம் (63) · சொல்லகராதி (37)',
   'இலக்கணம் (63) · சொல்லகராதி (37)',
   100, 5400, null, 6, 'paid'),
  ('g2tt7', 'g2_target_ta', 7, '{17}', 'Units 3 & 4', 'அலகு 3 & 4',
   'Units III & IV', 'அலகு III & IV',
   'எழுதும் திறன் (60) · கலைச் சொற்கள் (40)',
   'எழுதும் திறன் (60) · கலைச் சொற்கள் (40)',
   100, 5400, null, 7, 'paid'),
  ('g2tt8', 'g2_target_ta', 8, '{18}', 'Units 5 & 6', 'அலகு 5 & 6',
   'Units V & VI', 'அலகு V & VI',
   'வாசித்தல் – புரிந்து கொள்ளும் திறன் (75) · எளிய மொழிபெயர்ப்பு (25)',
   'வாசித்தல் – புரிந்து கொள்ளும் திறன் (75) · எளிய மொழிபெயர்ப்பு (25)',
   100, 5400, null, 8, 'paid'),
  ('g2tt9', 'g2_target_ta', 9, '{19}', 'Unit 7 — Literature', 'அலகு 7 — இலக்கியம்',
   'Unit VII', 'அலகு VII',
   'இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த்தொண்டும்',
   'இலக்கியம், தமிழ் அறிஞர்களும் தமிழ்த்தொண்டும்',
   100, 5400, null, 9, 'paid'),
  ('g2tt10', 'g2_target_ta', 10, '{20}', 'Tamil Full Test (as per syllabus)', 'தமிழ் முழுத் தேர்வு (பாடத்திட்டப்படி)',
   'Units I–VII', 'அலகு I–VII',
   'முழு பகுதி C வினா விகிதம் — 25/15/15/10/15/5/15',
   'முழு பகுதி C வினா விகிதம் — 25/15/15/10/15/5/15',
   100, 5400, null, 10, 'paid'),
  ('g2tt11', 'g2_target_ta', 11, '{41,47}', 'Grand Mock Test 1', 'முழு மாதிரித் தேர்வு 1',
   'Full Prelim Pattern', 'முழுத் தேர்வு முறை',
   'General Studies (100) + General Tamil (100) — the real 200-Q prelim',
   'பொது அறிவு (100) + பொது தமிழ் (100) — உண்மையான 200 வினா முதல்நிலைத் தேர்வு',
   200, 10800, null, 11, 'paid'),
  ('g2tt12', 'g2_target_ta', 12, '{42,48}', 'Grand Mock Test 2', 'முழு மாதிரித் தேர்வு 2',
   'Full Prelim Pattern', 'முழுத் தேர்வு முறை',
   'General Studies (100) + General Tamil (100) — the real 200-Q prelim',
   'பொது அறிவு (100) + பொது தமிழ் (100) — உண்மையான 200 வினா முதல்நிலைத் தேர்வு',
   200, 10800, null, 12, 'paid'),
  ('g2tt13', 'g2_target_ta', 13, '{43,49}', 'Grand Mock Test 3', 'முழு மாதிரித் தேர்வு 3',
   'Full Prelim Pattern', 'முழுத் தேர்வு முறை',
   'General Studies (100) + General Tamil (100) — the real 200-Q prelim',
   'பொது அறிவு (100) + பொது தமிழ் (100) — உண்மையான 200 வினா முதல்நிலைத் தேர்வு',
   200, 10800, null, 13, 'paid')
on conflict (id) do nothing;

-- ─── 5. Comp + revoke the two new plans from the superadmin console ──────────
-- Recreated to add 'target_g2_en' / 'target_g2_ta'. 'group1_mock_pack' is added
-- at the same time: that plan shipped without ever being added here, so comping
-- a Mock Pack has been failing with "unknown plan" since it launched.
create or replace function public.superadmin_grant_plan(p_user uuid, p_plan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  if p_plan not in (
    'premium_annual', 'vettri_nichayam', 'vettri_month', 'rank_booster_g2',
    'group1_mock_pack', 'target_g2_en', 'target_g2_ta'
  ) then
    raise exception 'unknown plan: %', p_plan;
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user not found';
  end if;

  insert into public.payments (user_id, razorpay_order_id, amount, currency, receipt, notes, status)
  values (
    p_user,
    'comp_' || replace(gen_random_uuid()::text, '-', ''),
    0,
    'INR',
    'superadmin comp',
    jsonb_build_object('plan', p_plan, 'comp', true, 'granted_by', auth.uid()),
    'paid'
  )
  returning payments.id into v_id;

  return v_id;
end;
$$;

grant execute on function public.superadmin_grant_plan(uuid, text) to authenticated;

-- Revoke Target Group 2 2026 (mirrors superadmin_revoke_rank_booster). Takes
-- the track so a buyer who holds both is not stripped of the one that was not
-- in question; NULL revokes both.
create or replace function public.superadmin_revoke_target_g2(
  p_user uuid,
  p_plan text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  if p_plan is not null and p_plan not in ('target_g2_en', 'target_g2_ta') then
    raise exception 'unknown plan: %', p_plan;
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user not found';
  end if;

  update public.payments
    set status = 'revoked'
    where user_id = p_user and status = 'paid'
      and notes->>'plan' = any(
        case when p_plan is null
          then array['target_g2_en', 'target_g2_ta']
          else array[p_plan]
        end
      );
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function public.superadmin_revoke_target_g2(uuid, text) to authenticated;
