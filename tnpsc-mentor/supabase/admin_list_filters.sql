-- ============================================================================
-- TNPSC Mentor — admin_list_questions: respect group_type + active
-- ----------------------------------------------------------------------------
-- The admin question-bank view previously ignored group_type and showed hidden
-- (active=false) rows, so PYQ · Group 1 · Aptitude returned 500 (capped) old
-- rows instead of the 151 live ones. Add both filters so the admin bank matches
-- what students actually get. Hidden rows remain in the DB (un-hide via SQL).
-- Idempotent.
-- ============================================================================

create or replace function public.admin_list_questions(p_config jsonb)
returns setof public.questions
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;  -- non-admins get nothing
  end if;
  return query
  select * from public.questions q
  where q.active
    and (p_config->>'category'       is null or q.category       = p_config->>'category')
    and (p_config->>'group_type'     is null or q.group_type     = p_config->>'group_type')
    and (p_config->>'subject'        is null or q.subject        = p_config->>'subject')
    and ((p_config->>'standard')     is null or q.standard       = (p_config->>'standard')::int)
    and (p_config->>'topic'          is null or q.topic          = p_config->>'topic')
    and (p_config->>'ca_type'        is null or q.ca_type        = p_config->>'ca_type')
    and (p_config->>'ca_month'       is null or q.ca_month       = p_config->>'ca_month')
    and (p_config->>'ca_topic'       is null or q.ca_topic       = p_config->>'ca_topic')
    and (p_config->>'aptitude_type'  is null or q.aptitude_type  = p_config->>'aptitude_type')
    and (p_config->>'aptitude_topic' is null or q.aptitude_topic = p_config->>'aptitude_topic')
  order by q.created_at desc
  limit 500;
end;
$$;

grant execute on function public.admin_list_questions(jsonb) to authenticated;
