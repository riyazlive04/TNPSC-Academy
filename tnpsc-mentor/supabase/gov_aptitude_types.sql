-- ============================================================================
-- TNPSC Mentor — widen aptitude_type for the GOV bank
-- ----------------------------------------------------------------------------
-- The GOV (TNPSC Group I Mains) aptitude bank adds two question families beyond
-- numerics/reasoning: 'data_interpretation' and 'general_studies'. Widen the
-- check constraint to allow them (purely additive — existing rows unaffected).
-- Re-runnable / idempotent.
-- ============================================================================

alter table public.questions drop constraint if exists questions_aptitude_type_check;
alter table public.questions add constraint questions_aptitude_type_check
  check (aptitude_type = any (array[
    'numerics', 'reasoning', 'data_interpretation', 'general_studies'
  ]));
