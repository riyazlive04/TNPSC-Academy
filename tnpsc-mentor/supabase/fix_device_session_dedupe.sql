-- ============================================================================
-- TNPSC Mentors — Fix the false "logged in on another device" lock-out
-- ----------------------------------------------------------------------------
-- The device cap bound to the GoTrue session_id, which is minted fresh on EVERY
-- login. A user who closed the tab without signing out (or whose refresh chain
-- broke) re-logged-in in the SAME browser and got a brand-new row each time; two
-- such stale rows tripped the 2-device cap on a single browser.
--
-- Fix: record the browser's stable client device_id (the app already sends it)
-- so repeat logins dedupe to one slot. This migration adds the column and does a
-- one-time cleanup of the duplicate rows already on disk so currently-locked-out
-- users are freed immediately. Idempotent / re-runnable.
-- ============================================================================

alter table public.user_sessions add column if not exists client_device_id text;

create index if not exists user_sessions_client_active_idx
  on public.user_sessions (user_id, client_device_id)
  where revoked_at is null;

-- One-time cleanup: collapse pre-existing same-browser duplicates. client_device_id
-- wasn't recorded before now, so we group active rows by (user_id, label) — two
-- active rows with the SAME label on one account are the same browser stacked by
-- repeat logins. Keep the most-recently-seen row per group; revoke the older
-- duplicates. Revoking only forces a re-login on a session that was already stale,
-- and going forward dedupe is precise (by client_device_id), so genuine distinct
-- devices that merely share a label are not collapsed again.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, coalesce(label, '')
      order by last_seen_at desc, created_at desc
    ) as rn
  from public.user_sessions
  where revoked_at is null
    and last_seen_at >= now() - interval '7 days'
)
update public.user_sessions u
set revoked_at = now()
from ranked r
where u.id = r.id
  and r.rn > 1;
