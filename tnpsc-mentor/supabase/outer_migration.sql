-- ============================================================================
-- TNPSC Mentors — "Outer" question bank support
-- ----------------------------------------------------------------------------
-- The subject question banks (schema/*.json) carry "Type": "outer" and a
-- subject-level category (botany, chemistry, …). We model these as a new
-- top-level category 'outer', with the JSON's category stored in `subject`
-- and its `unit` / `topic` preserved. Tamil "why_wrong_ta" gets its own column.
-- Re-runnable / idempotent.
-- ============================================================================

-- 1. Allow 'outer' as a category. The inline CHECK from schema.sql is
--    auto-named questions_category_check; drop and re-add the widened version.
alter table public.questions drop constraint if exists questions_category_check;
alter table public.questions
  add constraint questions_category_check
  check (category in ('pyq', 'samacheer', 'current_affairs', 'aptitude', 'outer'));

-- 2. Unit grouping (broad section above topic), e.g. 'Botany', 'Polity'.
alter table public.questions add column if not exists unit text;

-- 3. Tamil per-option rationale, mirroring the existing why_wrong jsonb.
alter table public.questions add column if not exists why_wrong_ta jsonb;

-- 4. Index to keep the admin "Outer" filter and per-subject chips fast.
create index if not exists idx_questions_unit on public.questions(unit);
