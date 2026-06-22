-- ─── Concurrent-session limiting ────────────────────────────────────────────
-- Track active device sessions per account so a login can be limited to at most
-- N simultaneous devices (anti credential-sharing). Writes are server-only
-- (service role); a user may READ their own rows for the "Devices" screen.

create table if not exists public.user_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- The cap-binding key: the unforgeable GoTrue session_id (a fresh one per login).
  device_id    text not null,
  -- The browser's STABLE localStorage id. Lets repeat logins from one browser
  -- dedupe to a single slot, so the limit counts distinct devices rather than
  -- accumulated login sessions. Nullable: legacy rows + private-mode clients.
  client_device_id text,
  label        text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz,
  unique (user_id, device_id)
);

-- Re-runnable for existing databases (the table above only creates fresh).
alter table public.user_sessions add column if not exists client_device_id text;

-- Fast "active sessions for this user" count (the login-time limit check).
create index if not exists user_sessions_user_active_idx
  on public.user_sessions (user_id)
  where revoked_at is null;

-- Fast lookup of a browser's own active rows (the same-device dedupe at login).
create index if not exists user_sessions_client_active_idx
  on public.user_sessions (user_id, client_device_id)
  where revoked_at is null;

alter table public.user_sessions enable row level security;

-- Users may read their own sessions (manage-devices screen, via the user client).
-- There are deliberately NO write policies: only the service-role server inserts,
-- heartbeats and revokes rows, so the limit can't be tampered with from a browser.
drop policy if exists user_sessions_self_select on public.user_sessions;
create policy user_sessions_self_select on public.user_sessions
  for select using (auth.uid() = user_id);
