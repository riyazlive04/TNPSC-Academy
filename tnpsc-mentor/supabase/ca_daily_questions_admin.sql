-- ============================================================================
-- TNPSC Mentors — superadmin verify/curate workflow for ca_daily_questions
-- ----------------------------------------------------------------------------
-- The VPS pipeline auto-authors ~15 day_wise MCQs each morning; the superadmin
-- console (CA Questions tab) can now VERIFY / edit / add / remove them before
-- they're ever served. This adds the review-state columns. Edits/inserts happen
-- via the service-role key (RLS on, no policies) through /api/ca-questions.
--
-- Safe against the pipeline: its push is INSERT-ONLY on external_id, so an edited
-- or verified row is never overwritten by a later re-push; admin-added rows use
-- an external_id the pipeline can't emit (`ca-daily-<date>-m<epoch>`). Idempotent.
-- ============================================================================

alter table public.ca_daily_questions
  add column if not exists verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

-- Fast "unverified for a day" scans in the review UI.
create index if not exists ca_daily_questions_verified_idx
  on public.ca_daily_questions (date, verified);
