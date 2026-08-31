-- ============================================================================
-- TNPSC Mentors — CA magazine "know level" (Must / Should / Good to know)
-- ----------------------------------------------------------------------------
-- A superadmin triage flag on each magazine item, set in the issue editor and
-- shown to students as a badge (and as a filter) in the reader, the PDF and the
-- class slides. It is DELIBERATELY nullable: the VPS pipeline pushes items with
-- no level, and an unreviewed item must render exactly as it does today rather
-- than defaulting into a level nobody chose.
--
-- Stored as the short keys ('must' | 'should' | 'good'), never the display
-- text — the labels are bilingual and live in the app (lib/caMagazine.ts), so
-- re-wording them must never require touching a single row.
-- Idempotent; run via server/run-migration.mjs.
-- ============================================================================

alter table public.ca_magazine add column if not exists know_level text;

-- Re-add the CHECK every run so a re-run repairs a dropped/edited constraint.
alter table public.ca_magazine drop constraint if exists ca_magazine_know_level_check;
alter table public.ca_magazine add constraint ca_magazine_know_level_check
  check (know_level is null or know_level in ('must', 'should', 'good'));

-- The reader filters an issue by level, so the lookup is always scoped to one
-- issue first. Partial: the rows with no level are the ones never filtered for.
create index if not exists ca_magazine_know_level_idx
  on public.ca_magazine (ca_type, date, know_level)
  where know_level is not null;
