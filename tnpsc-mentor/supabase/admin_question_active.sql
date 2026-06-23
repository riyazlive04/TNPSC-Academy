-- ============================================================================
-- TNPSC Mentors — admin enable/disable a single question
-- ----------------------------------------------------------------------------
-- One-click toggle of questions.active for admins/superadmins:
--   active = true  -> shown to students (quizzes + spaced revision)
--   active = false -> hidden from students; still visible in the admin bank.
-- The active flag itself already exists (see active_flag.sql); this just exposes
-- a lightweight, is_admin()-gated setter that returns the updated row.
-- Re-runnable / idempotent.
-- ============================================================================

create or replace function public.admin_set_question_active(p_id uuid, p_active boolean)
returns questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.questions;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.questions
     set active = coalesce(p_active, true)
   where id = p_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'question % not found', p_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_set_question_active(uuid, boolean) to authenticated;
