-- ============================================================================
-- TNPSC Mentor — add per-question figure support
-- ----------------------------------------------------------------------------
-- Adds an `images` column holding an ordered JSON array of public image URLs
-- (hosted in the Supabase Storage bucket `question-images`). The column is
-- threaded into the quiz + spaced-revision RPCs (see secure.sql) so figures
-- reach the client WITH the question stem, while answers stay gated.
--
-- Run together with secure.sql, which is re-applied to recreate the two RPCs
-- whose return shape now includes `images`:
--   node load-env-run.mjs ../supabase/add_question_images.sql ../supabase/secure.sql
-- Idempotent / re-runnable.
-- ============================================================================

alter table public.questions add column if not exists images jsonb;

-- CREATE OR REPLACE cannot change a function's return type; drop before secure.sql
-- recreates them with `images` in the return table.
drop function if exists public.get_quiz_questions(jsonb);
drop function if exists public.get_due_reviews(int);
