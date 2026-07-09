-- ============================================================================
-- TNPSC Mentors — Popup Alert "kind" (type of announcement)
-- ----------------------------------------------------------------------------
-- A popup is no longer always an "alert": the superadmin picks a type so the
-- popup renders with a fitting icon / colour / label:
--   info    → Information (neutral, the default)
--   alert   → Alert / important (amber)
--   update  → Update / new feature (violet)
--   success → Good news (mint)
-- Existing rows default to 'info'. Idempotent; run via server/run-migration.mjs.
-- ============================================================================

alter table public.app_alerts
  add column if not exists kind text not null default 'info';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_alerts_kind_check'
      and conrelid = 'public.app_alerts'::regclass
  ) then
    alter table public.app_alerts
      add constraint app_alerts_kind_check
      check (kind in ('info', 'alert', 'update', 'success'));
  end if;
end $$;
