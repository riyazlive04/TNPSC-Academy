-- Migration: record_abandoned_test RPC
-- Records a test session that was exited mid-way (status = 'abandoned').
-- Run after secure.sql and schema.sql.

create or replace function public.record_abandoned_test(p_session jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.test_sessions (
    user_id, category, group_type, subject, standard, ca_month, ca_type,
    aptitude_type, aptitude_topic, total_questions, attempted,
    time_limit_seconds, time_taken_seconds, status
  ) values (
    v_user,
    p_session->>'category',
    p_session->>'group_type',
    p_session->>'subject',
    (p_session->>'standard')::int,
    p_session->>'ca_month',
    p_session->>'ca_type',
    p_session->>'aptitude_type',
    p_session->>'aptitude_topic',
    coalesce((p_session->>'total_questions')::int, 0),
    coalesce((p_session->>'attempted')::int, 0),
    coalesce((p_session->>'time_limit_seconds')::int, 0),
    coalesce((p_session->>'time_taken_seconds')::int, 0),
    'abandoned'
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.record_abandoned_test(jsonb) to authenticated;
