-- ============================================================================
-- TNPSC Mentors — Publish a CA-questions SET to students as a downloadable PDF
-- ----------------------------------------------------------------------------
-- Mirrors the magazine publish flow (ca_magazine_publish.sql): a superadmin
-- turns on "Student PDF" for one question set, which inserts a materials row
-- with the new kind='questions' referencing the set by
-- (questions_source, questions_key):
--   questions_source = 'daily'   → questions_key = the date  ('2026-07-09')
--   questions_source = 'monthly' → questions_key = the month ('July 2026')
--
-- The PDF itself is generated client-side from the set's rows — nothing is
-- stored in Storage. Students may only read the rows when that materials row is
-- BOTH active AND downloadable, so the admin toggle fully gates it.
--
-- NOTE: enabling a MONTHLY bank hands students the full answer key for the same
-- questions the credit-gated month tests draw from. Daily sets have no student
-- test surface, so they carry no such trade-off.
-- Idempotent; run via server/run-migration.mjs.
-- ============================================================================

-- 1) Allow the new kind. The check may have been (re)created by an earlier
--    migration under any name — drop whatever CHECK governs `kind`, re-add.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.materials'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind%'
  loop
    execute format('alter table public.materials drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.materials add constraint materials_kind_check
  check (kind in ('video', 'image', 'pdf', 'document', 'magazine', 'questions'));

-- 2) Soft reference to the published set (kind='questions' rows only).
alter table public.materials add column if not exists questions_source text
  check (questions_source in ('daily', 'monthly'));
alter table public.materials add column if not exists questions_key text;

-- A set can be published at most once.
create unique index if not exists materials_questions_set_key
  on public.materials (questions_source, questions_key)
  where kind = 'questions';
