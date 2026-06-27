-- ============================================================================
-- TNPSC Mentors — Notifications (Web Push + in-app feed)
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql. Three tables:
--   • push_subscriptions — a user's browser Web Push endpoints (one per device).
--   • notifications       — admin-authored messages. kind='push' also fires a
--                           Web Push to devices; kind='system' is in-app only.
--   • notification_reads  — per-user read state for the in-app bell/feed.
--
-- Trust model mirrors payments/coupons: the SERVER (service role) writes
-- notifications and reads subscriptions; RLS only governs what a USER may read
-- of their own rows. Idempotent.
-- ============================================================================

-- ─── Push subscriptions (one row per browser/device) ─────────────────────────
create table if not exists public.push_subscriptions (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
-- Users may see/remove their own device subscriptions; the server (service role)
-- does the actual sending and bypasses RLS.
drop policy if exists "Users manage own push subs" on public.push_subscriptions;
create policy "Users manage own push subs"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, delete on public.push_subscriptions to authenticated;

-- ─── Notifications (admin-authored) ──────────────────────────────────────────
create table if not exists public.notifications (
  id           uuid default uuid_generate_v4() primary key,
  -- 'push'   → also delivered to devices via Web Push.
  -- 'system' → in-app announcement only (shown in the feed / as a banner).
  kind         text not null default 'push' check (kind in ('push', 'system')),
  title        text not null,
  body         text not null,
  -- Optional deep link opened when the notification is clicked.
  url          text,
  -- Audience targeting. 'all' | 'premium' | 'free' | 'group'. For 'group',
  -- audience_value holds the target_group (e.g. 'Group1').
  audience       text not null default 'all'
                   check (audience in ('all', 'premium', 'free', 'group')),
  audience_value text,
  -- Per-user targeting (server-authored system messages, e.g. "your free subject
  -- test is used up"). When set, the message goes ONLY to this user and the
  -- audience fields are ignored by the feed matcher. NULL = a broadcast governed
  -- by `audience` (the admin-authored case).
  target_user_id uuid references auth.users(id) on delete cascade,
  -- Delivery bookkeeping for the admin history view (push only).
  push_sent    integer not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_notifications_created on public.notifications(created_at desc);

-- Backfill target_user_id on pre-existing databases: the create-table above is a
-- no-op once the table exists, so the column must be added explicitly here —
-- BEFORE the partial index below references it. Idempotent.
alter table public.notifications
  add column if not exists target_user_id uuid references auth.users(id) on delete cascade;

-- Per-user feed lookups probe target_user_id; a partial index keeps it tiny
-- (only the targeted rows, not the broadcast majority).
create index if not exists idx_notifications_target_user
  on public.notifications(target_user_id) where target_user_id is not null;

-- RLS ON but NO user policies → reads go through the server (service role),
-- which applies audience filtering per user. Keeps targeting logic in one place.
alter table public.notifications enable row level security;

-- ─── Per-user read state for the in-app feed ─────────────────────────────────
create table if not exists public.notification_reads (
  user_id         uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, notification_id)
);

alter table public.notification_reads enable row level security;
drop policy if exists "Users manage own reads" on public.notification_reads;
create policy "Users manage own reads"
  on public.notification_reads for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert on public.notification_reads to authenticated;
