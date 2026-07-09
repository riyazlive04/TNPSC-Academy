-- ============================================================================
-- TNPSC Mentors — Test Marathon free tier ("Test 1 FREE — try before you enroll")
-- ----------------------------------------------------------------------------
-- Run AFTER test_series.sql. Adds a per-test `tier` mirroring mock_exams:
--   'paid' (default) → needs a paid bundle (premium OR Vettri), as before.
--   'free'           → open to EVERY signed-in user. The date gate and the
--                      2-attempt cap still apply; no credits are charged
--                      (the series flow never charges credits).
-- Seeds Test 1 as the free trial paper, matching the marketing flyer.
-- Idempotent / re-runnable.
-- ============================================================================

alter table public.test_series
  add column if not exists tier text not null default 'paid'
  check (tier in ('free', 'paid'));

update public.test_series
   set tier = 'free', updated_at = now()
 where id = 'test1' and tier <> 'free';
