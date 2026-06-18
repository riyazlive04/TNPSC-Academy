-- ─── Concurrent-session limiting ────────────────────────────────────────────
-- Track active device sessions per account so a login can be limited to at most
-- N simultaneous devices (anti credential-sharing). Writes are server-only
-- (service role); a user may READ their own rows for the "Devices" screen.

create table if not exists public.user_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  device_id    text not null,
  label        text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz,
  unique (user_id, device_id)
);

-- Fast "active sessions for this user" count (the login-time limit check).
create index if not exists user_sessions_user_active_idx
  on public.user_sessions (user_id)
  where revoked_at is null;

alter table public.user_sessions enable row level security;

-- Users may read their own sessions (manage-devices screen, via the user client).
-- There are deliberately NO write policies: only the service-role server inserts,
-- heartbeats and revokes rows, so the limit can't be tampered with from a browser.
drop policy if exists user_sessions_self_select on public.user_sessions;
create policy user_sessions_self_select on public.user_sessions
  for select using (auth.uid() = user_id);
