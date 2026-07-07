-- ============================================================================
-- TNPSC Mentors — Popup Alerts (superadmin-authored, shown as a modal popup)
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql. Two tables:
--   • app_alerts       — superadmin-authored announcements shown to users as a
--                        blocking popup on app open (until dismissed). Optional
--                        Tamil copy, optional deep link, optional expiry.
--   • alert_dismissals — per-user "got it" state so an alert shows once per
--                        account (across devices), mirroring notification_reads.
--
-- Trust model mirrors notifications: the SERVER (service role) writes alerts
-- and applies audience filtering; RLS only governs a user's own dismissals.
-- Idempotent.
-- ============================================================================

-- ─── Alerts (superadmin-authored) ────────────────────────────────────────────
create table if not exists public.app_alerts (
  id           uuid default uuid_generate_v4() primary key,
  title        text not null,
  body         text not null,
  -- Optional Tamil copy: shown when the learner's language is 'ta' (or 'both').
  title_ta     text,
  body_ta      text,
  -- Optional deep link opened from the popup's "View" button.
  url          text,
  -- Audience targeting, same vocabulary as notifications. For 'group',
  -- audience_value holds the target_group (e.g. 'Group1').
  audience       text not null default 'all'
                   check (audience in ('all', 'premium', 'free', 'group')),
  audience_value text,
  -- Kill switch: superadmin can pull an alert without deleting its history.
  active       boolean not null default true,
  -- Optional auto-expiry; NULL = shows until deactivated.
  expires_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_app_alerts_active
  on public.app_alerts(created_at desc) where active;

-- RLS ON but NO user policies → reads go through the server (service role),
-- which applies audience filtering per user. Keeps targeting logic in one place.
alter table public.app_alerts enable row level security;

-- ─── Per-user dismissal state ────────────────────────────────────────────────
create table if not exists public.alert_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  alert_id     uuid not null references public.app_alerts(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);

alter table public.alert_dismissals enable row level security;
drop policy if exists "Users manage own alert dismissals" on public.alert_dismissals;
create policy "Users manage own alert dismissals"
  on public.alert_dismissals for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert on public.alert_dismissals to authenticated;
