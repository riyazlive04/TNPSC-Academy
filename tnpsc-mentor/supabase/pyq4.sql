-- ============================================================================
-- TNPSC Mentors — Group 4 / VAO Previous-Year Questions (category='pyq4')
-- ----------------------------------------------------------------------------
-- A third self-contained PYQ bank alongside Group 1 ('pyq') and Group 2/2A
-- ('pyq2'). 1000 rows: 5 exam years (2018, 2019, 2022, 2024, 2025) x 200, each
-- year being the General Tamil paper (100, Tamil-only) and the GS/Maths paper
-- (100, bilingual), the latter splitting into the GS and Aptitude sections.
--
-- Row mapping (drives the picker: Group 4 -> section -> All + sub-type -> year):
--   subject = SECTION  : 'Tamil' | 'General Studies' | 'Aptitude'
--   topic   = SUB-TYPE : normalized skill/subject area; on Aptitude rows it
--                        stays the source micro-topic and is a badge only
--   aptitude_type      : 'numerics' | 'reasoning'  (Aptitude rows only)
--   year               : the exam year (badge + year filter)
--
-- Like Group 2, this bank needs NO new sampler: get_quiz_questions /
-- count_quiz_questions / question_topic_counts already filter generically on
-- category + subject + topic + aptitude_type + year, and their category guards
-- are a DENYLIST ('outer'/'mock'/'testseries'/'vettri'), so 'pyq4' passes
-- through untouched.
--
-- The questions themselves are loaded by server/import_pyq4.mjs.
--
-- Run AFTER schema.sql. Idempotent: safe to re-run. Apply with:
--   node run-migration.mjs ../supabase/pyq4.sql
-- ============================================================================

-- ─── Allow category = 'pyq4' ────────────────────────────────────────────────
-- The constraint is recreated with EVERY category currently in use plus 'pyq4'.
-- It has been redefined by six earlier migrations and has drifted before (see
-- vettri.sql), so it is restated in full rather than amended — the live
-- definition, not this file's history, is what the ADD scan validates against.
-- Every listed value already exists in the table, so the scan passes.
alter table public.questions drop constraint if exists questions_category_check;
alter table public.questions add constraint questions_category_check
  check (category in (
    'pyq', 'pyq2', 'pyq4', 'samacheer', 'current_affairs', 'aptitude',
    'outer', 'subject', 'mock', 'testseries', 'vettri'
  ));

-- ─── Year filter index ──────────────────────────────────────────────────────
-- The section page counts every sub-type per year, so category+subject+year is
-- the hot path for both question_topic_counts and count_quiz_questions.
create index if not exists idx_questions_pyq4_section
  on public.questions (category, subject, year)
  where category = 'pyq4';
