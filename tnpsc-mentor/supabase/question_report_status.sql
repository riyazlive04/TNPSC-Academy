-- ============================================================================
-- TNPSC Mentors — Admin triage surface for student question reports
-- ----------------------------------------------------------------------------
-- Run AFTER question_reports.sql + superadmin.sql. Students write to
-- `question_reports` (one row per user per question — see question_reports.sql).
-- This migration adds the ADMIN side of that loop: a per-question triage state
-- (open / resolved / dismissed) plus the read/write RPCs the admin + superadmin
-- consoles call. All RPCs are SECURITY DEFINER and is_admin()-gated (superadmins
-- inherit is_admin()), mirroring admin_write.sql. Idempotent / re-runnable.
--
-- Design notes:
--   • Student report rows are facts and stay untouched. Triage state lives in a
--     SEPARATE admin-owned table so students never need write access to it and
--     the two concerns don't tangle in RLS.
--   • "Effective" status reopens automatically: if a fresh report lands AFTER an
--     admin resolved/dismissed a question (last report newer than resolved_at),
--     it surfaces as `open` again — no student write to the status table needed.
-- ============================================================================

-- ─── 1. Admin-owned triage state (one row per reported question) ─────────────
create table if not exists public.question_report_status (
  question_id text primary key,
  status      text not null default 'open'
                check (status in ('open', 'resolved', 'dismissed')),
  note        text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.question_report_status enable row level security;

-- Admins + superadmins fully manage triage state; students have no access.
drop policy if exists "admin manage report status" on public.question_report_status;
create policy "admin manage report status"
  on public.question_report_status for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.question_report_status to authenticated;

-- ─── 2. List reported questions for triage ───────────────────────────────────
-- Aggregates question_reports by question_id, joins the question content (so the
-- console can show + edit the offending question) and the triage state. Filters
-- by EFFECTIVE status (see header). `question` is the full questions row as
-- jsonb (null when the question was since deleted), which maps 1:1 onto the
-- frontend Question type.
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
      max(r.updated_at)                                     as last_reported
    from public.question_reports r
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

-- ─── 3. Set the triage status of one reported question ───────────────────────
-- Upserts the admin-owned status row. Resolving / dismissing stamps the actor +
-- timestamp; reopening clears them so the effective-status logic treats it fresh.
create or replace function public.admin_set_report_status(
  p_question_id text,
  p_status      text,
  p_note        text default null
)
returns public.question_report_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.question_report_status;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'invalid status: %', p_status;
  end if;

  insert into public.question_report_status (question_id, status, note, resolved_by, resolved_at, updated_at)
  values (
    p_question_id,
    p_status,
    nullif(p_note, ''),
    case when p_status = 'open' then null else auth.uid() end,
    case when p_status = 'open' then null else now() end,
    now()
  )
  on conflict (question_id) do update set
    status      = excluded.status,
    note        = excluded.note,
    resolved_by = excluded.resolved_by,
    resolved_at = excluded.resolved_at,
    updated_at  = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_set_report_status(text, text, text) to authenticated;

-- ─── 4. Count of currently-open reported questions (nav badge) ───────────────
create or replace function public.admin_count_open_reports()
returns int
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select count(*) into v_count
  from (
    select r.question_id, max(r.updated_at) as last_reported
    from public.question_reports r
    group by r.question_id
  ) a
  left join public.question_report_status s on s.question_id = a.question_id
  where s.status is null
     or s.status = 'open'
     or s.resolved_at is null
     or a.last_reported > s.resolved_at;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.admin_count_open_reports() to authenticated;
