-- Public CA archive export: one JSON object per line, read by build.mjs.
-- Run ON THE VPS (the local .env points at the retired Cloud DB):
--   docker cp scripts/ca-archive/export.sql supabase-db:/tmp/ca-export.sql
--   docker exec supabase-db psql -U supabase_admin -d postgres -qAt -f /tmp/ca-export.sql > server/_ca/ca.ndjson
-- Use -qAt (quiet: no BEGIN/COMMIT tags), never \copy: COPY escapes the backslashes inside the JSON.
--
-- Exports EVERY row, published or not, so question slugs are assigned over a
-- set that does not change when a day is approved later (no URL ever moves).
-- The publication gate is applied in build.mjs against the 'pub' rows, where
-- it is tested. The dump stays on the box.
\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;

-- Which days are public: an active materials row is the superadmin's approval.
select row_to_json(t) from (
  select 'pub' as k, 'magazine' as type, magazine_date::text as date
  from public.materials
  where kind = 'magazine' and magazine_ca_type = 'day_wise' and active and magazine_date is not null
  union all
  select 'pub', 'daily_q', questions_key
  from public.materials
  where kind = 'questions' and questions_source = 'daily' and active and questions_key is not null
) t;

-- Daily magazine items (the monthly compilation re-cuts these; not published).
select row_to_json(t) from (
  select 'item' as k, id, external_id, date::text as date, topic, title, title_ta,
         content, content_ta, know_level
  from public.ca_magazine
  where ca_type = 'day_wise'
  order by date, external_id
) t;

-- Daily questions.
select row_to_json(t) from (
  select 'dq' as k, id, external_id, created_at, active, date::text as date, ca_topic, topic,
         question_type, question_text, question_text_ta,
         option_a, option_b, option_c, option_d,
         option_a_ta, option_b_ta, option_c_ta, option_d_ta,
         correct_answer, explanation, explanation_ta, why_wrong
  from public.ca_daily_questions
  order by created_at, external_id
) t;

-- Monthly CA bank.
select row_to_json(t) from (
  select 'mq' as k, id, external_id, created_at, active, ca_month, ca_year, ca_topic, topic,
         question_type, question_text, question_text_ta,
         option_a, option_b, option_c, option_d,
         option_a_ta, option_b_ta, option_c_ta, option_d_ta,
         correct_answer, explanation, explanation_ta, why_wrong, images, option_images
  from public.questions
  where category = 'current_affairs'
  order by created_at, external_id
) t;

commit;
