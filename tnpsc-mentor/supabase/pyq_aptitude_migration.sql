-- ============================================================================
-- TNPSC Mentor — Move the AllYears aptitude import into PYQ → Aptitude (Group 1)
-- ----------------------------------------------------------------------------
-- The 151 imported rows were loaded as category='aptitude'. The product intent
-- is the Previous-Year-Paper "Aptitude" subject under Group 1, with a
-- data-driven topic step. This:
--   1. grants SELECT on `active` so the PostgREST topics picker can filter it,
--   2. re-tags the 151 into category=pyq / Group1 / subject=Aptitude and copies
--      their fine-grained aptitude_topic into the standard `topic` column (the
--      column the PYQ quiz + topics picker use),
--   3. restores the standalone aptitude bank we hid earlier (that was the wrong
--      bucket — leave it as it was),
--   4. hides the OLD PYQ-Aptitude rows so only the 151 new ones surface.
-- Idempotent / re-runnable.
-- ============================================================================

-- 1. The topics picker queries the questions table directly as `authenticated`;
--    secure.sql's column grants didn't include the new `active` flag.
grant select (active) on public.questions to authenticated;

-- 2. Re-tag the 151 imported rows (only ones tagged official AND still aptitude).
update public.questions
set category   = 'pyq',
    group_type = 'Group1',
    subject    = 'Aptitude',
    topic      = coalesce(topic, aptitude_topic)
where category = 'aptitude'
  and source_url = 'tnpsc-official';

-- 3. Un-hide the standalone aptitude bank (undo the earlier mis-targeted hide).
update public.questions
set active = true
where category = 'aptitude'
  and active = false;

-- 4. Hide the old PYQ-Aptitude rows; the 151 new ones are tagged official.
update public.questions
set active = false
where category = 'pyq'
  and subject = 'Aptitude'
  and source_url is distinct from 'tnpsc-official';
