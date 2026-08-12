-- ============================================================================
-- Live exam-year list for the section-wise PYQ groups (Group 2 / 2A, Group 4).
--
-- The year chips used to be a hardcoded array in the client (PYQ_GROUPS.years in
-- src/lib/constants.ts), so loading a new year into the bank showed its
-- questions in the counts and in "All Years" while the chip row silently kept
-- the old list — the year was in the DB but unreachable in the UI until someone
-- edited the constant, rebuilt and redeployed. This sources the chips from the
-- bank instead, mirroring ca_month_counts / the CA month picker: import a year,
-- and it appears.
--
-- Optional cfg.subject narrows to one section, so a section page only offers the
-- years that section actually has (e.g. a year with no English paper).
--
-- Idempotent: safe to re-run. Run with:
--   node run-migration.mjs ../supabase/pyq_years.sql
-- ============================================================================

create or replace function public.question_year_counts(p_config jsonb)
returns table(year integer, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  with cfg as (
    select
      p_config->>'category'      as category,
      p_config->>'subject'       as subject,
      p_config->>'aptitude_type' as aptitude_type
  )
  select q.year, count(*)
  from public.questions q, cfg
  where q.category = cfg.category
    and (cfg.category in ('samacheer', 'current_affairs') or q.active)
    and (cfg.subject is null or q.subject = cfg.subject)
    and (cfg.aptitude_type is null or q.aptitude_type = cfg.aptitude_type)
    and q.year is not null
  group by q.year
  order by q.year desc;
$$;

grant execute on function public.question_year_counts(jsonb) to authenticated;
