-- ============================================================================
-- TNPSC Mentors — Native push device tokens (APNs / FCM)
-- ----------------------------------------------------------------------------
-- Run AFTER notifications.sql. Idempotent.
--
-- Web Push cannot reach the installed apps: WKWebView has no Push API at all,
-- and the Android WebView's service worker holds no subscription the OS will
-- wake. The apps therefore register with the OS push service and store the
-- resulting device token here, alongside (not instead of) push_subscriptions.
--
-- Both platforms deliver through Firebase Cloud Messaging — Android natively,
-- iOS by way of the APNs auth key uploaded into the Firebase project — so one
-- sender covers both and `platform` is only for bookkeeping and debugging.
-- ============================================================================

create table if not exists public.push_devices (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- The FCM registration token. Rotates on reinstall, restore-to-new-device and
  -- occasionally on its own, so it is the natural conflict key: re-registering
  -- the same token simply refreshes the row rather than accumulating duplicates.
  token       text not null unique,
  platform    text not null check (platform in ('ios', 'android')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_push_devices_user on public.push_devices(user_id);

create or replace function public.touch_push_devices_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_push_devices_updated_at on public.push_devices;
create trigger trg_push_devices_updated_at
  before update on public.push_devices
  for each row execute function public.touch_push_devices_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Writes happen server-side with the service role. Users may read their own
-- rows so the Profile screen can show which devices are receiving pushes.
alter table public.push_devices enable row level security;

drop policy if exists "Users read own push devices" on public.push_devices;
create policy "Users read own push devices"
  on public.push_devices for select to authenticated
  using (user_id = auth.uid());

grant select on public.push_devices to authenticated;

comment on table public.push_devices is
  'APNs/FCM device tokens for the native apps. Web browsers use push_subscriptions instead.';
