-- ============================================================================
-- TNPSC Mentors — CA Magazine publishing (superadmin approve → Materials)
-- ----------------------------------------------------------------------------
-- The VPS pipeline pushes magazine items into ca_magazine (see
-- ca_generator.sql); students must NOT see them until a superadmin reviews an
-- issue in the console and approves it. Approval = inserting a materials row
-- with the new kind='magazine' that references the issue by
-- (magazine_ca_type, magazine_date). The row then rides ALL the existing
-- materials plumbing: it appears in the Materials tab, active=false hides it,
-- DELETE unpublishes — the ca_magazine rows themselves are never touched.
-- Idempotent; run via server/run-migration.mjs.
-- ============================================================================

-- 1) Allow the new kind. The original check constraint was created inline, so
--    its name may vary — drop whatever CHECK governs `kind`, then re-add.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.materials'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind%'
  loop
    execute format('alter table public.materials drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.materials add constraint materials_kind_check
  check (kind in ('video', 'image', 'pdf', 'document', 'magazine'));

-- 2) Soft reference to the published issue (kind='magazine' rows only). No FK:
--    ca_magazine is keyed per item, an issue is the (ca_type, date) group.
alter table public.materials add column if not exists magazine_ca_type text
  check (magazine_ca_type in ('day_wise', 'month_wise'));
alter table public.materials add column if not exists magazine_date date;

-- An issue can be published at most once.
create unique index if not exists materials_magazine_issue_key
  on public.materials (magazine_ca_type, magazine_date)
  where kind = 'magazine';

-- 3) Issue list for the superadmin console: one row per pushed issue
--    (day or month) with its item count. Server-only, like the table.
create or replace function public.ca_magazine_issues()
returns table(ca_type text, date date, ca_month text, ca_year int, items bigint)
language sql
security definer
stable
set search_path = public
as $$
  select m.ca_type, m.date, m.ca_month, max(m.ca_year) as ca_year, count(*) as items
  from public.ca_magazine m
  group by m.ca_type, m.date, m.ca_month
  order by m.date desc, m.ca_type;
$$;

revoke execute on function public.ca_magazine_issues() from public;
revoke execute on function public.ca_magazine_issues() from anon;
revoke execute on function public.ca_magazine_issues() from authenticated;
grant execute on function public.ca_magazine_issues() to service_role;
