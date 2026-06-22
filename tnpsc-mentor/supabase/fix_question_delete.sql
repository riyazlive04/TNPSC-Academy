-- ============================================================================
-- TNPSC Mentor — Make questions deletable again
-- ----------------------------------------------------------------------------
-- test_answers.question_id was created with a plain `references questions(id)`,
-- which defaults to ON DELETE NO ACTION (RESTRICT). That meant any question that
-- had EVER been answered in a test could not be deleted — admin_delete_question
-- raised a foreign-key violation (23503).
--
-- Switch the rule to ON DELETE SET NULL: deleting a question no longer fails and
-- no longer wipes user history. The answer row keeps is_correct/selected_answer
-- (so past session scores are unchanged); only the pointer to the now-gone
-- question content is nulled. Idempotent / re-runnable.
-- ============================================================================

alter table public.test_answers
  drop constraint if exists test_answers_question_id_fkey;

alter table public.test_answers
  add constraint test_answers_question_id_fkey
  foreign key (question_id) references public.questions(id) on delete set null;
