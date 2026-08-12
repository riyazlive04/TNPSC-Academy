-- ============================================================================
-- Show WHO reported a question in the superadmin console.
--
-- admin_list_question_reports aggregates question_reports by question_id, so the
-- reporters were grouped away: the console could see HOW MANY students flagged a
-- question and WHAT they wrote, but never who — the only name it joined was
-- resolver_name, the admin who closed the item. That made it impossible to
-- follow up with a reporter, or to spot one account mass-flagging questions.
--
-- Adds a `reporters` array (name, email, their reason, when). Populated only for
-- superadmins — plain admins keep the existing anonymous triage view, since the
-- reasons alone are enough to fix a question and this is student PII.
--
-- The return signature changes, so the old function must be dropped first;
-- create-or-replace cannot alter `returns table`.
--
-- Idempotent: safe to re-run. Run with:
--   node run-migration.mjs ../supabase/report_reporters.sql
-- ============================================================================

drop function if exists public.admin_list_question_reports(text, int);

create or replace function public.admin_list_question_reports(
  p_status text default 'open',
  p_limit  int  default 200
)
returns table (
  question_id    text,
  report_count   bigint,
  reasons        text[],
  first_reported timestamptz,
  last_reported  timestamptz,
  status         text,
  note           text,
  resolved_at    timestamptz,
  resolver_name  text,
  reporters      jsonb,
  question       jsonb
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'invalid status: %', p_status;
  end if;

  return query
  with agg as (
    select
      r.question_id,
      count(*)                                              as report_count,
      array_remove(array_agg(r.reason order by r.updated_at desc), null) as reasons,
      min(r.created_at)                                     as first_reported,
      max(r.updated_at)                                     as last_reported,
      -- Who flagged it, newest first. Superadmin-only (masked below).
      jsonb_agg(
        jsonb_build_object(
          'user_id',     r.user_id,
          'name',        pr.full_name,
          'email',       pr.email,
          'reason',      r.reason,
          'reported_at', r.updated_at
        )
        order by r.updated_at desc
      )                                                     as reporters
    from public.question_reports r
    left join public.profiles pr on pr.id = r.user_id
    group by r.question_id
  )
  select
    a.question_id,
    a.report_count,
    a.reasons,
    a.first_reported,
    a.last_reported,
    -- Effective status: a report newer than the resolution reopens the item.
    case
      when s.status is null then 'open'
      when s.status = 'open' then 'open'
      when s.resolved_at is null or a.last_reported > s.resolved_at then 'open'
      else s.status
    end                                                     as status,
    s.note,
    s.resolved_at,
    p.full_name                                             as resolver_name,
    -- Identities to superadmins only; admins get null and the anonymous view.
    case when public.is_superadmin() then a.reporters else null end as reporters,
    -- NULL (not an all-null object) when the question was since deleted.
    case when q.id is null then null else to_jsonb(q.*) end as question
  from agg a
  left join public.question_report_status s on s.question_id = a.question_id
  left join public.questions q              on q.id::text = a.question_id
  left join public.profiles  p              on p.id = s.resolved_by
  where (
    case
      when s.status is null then 'open'
      when s.status = 'open' then 'open'
      when s.resolved_at is null or a.last_reported > s.resolved_at then 'open'
      else s.status
    end
  ) = p_status
  order by a.last_reported desc
  limit greatest(1, least(p_limit, 1000));
end;
$$;

grant execute on function public.admin_list_question_reports(text, int) to authenticated;
