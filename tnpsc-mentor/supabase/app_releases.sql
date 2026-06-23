-- ============================================================================
-- TNPSC Mentors — Android APK release registry
-- ----------------------------------------------------------------------------
-- Superadmins upload the app's .apk from the console; the binary goes to the
-- public `app-releases` Storage bucket and one row is recorded here per upload.
-- The NEWEST row (by created_at) is the "current" release the public download
-- endpoints serve — so a fresh upload goes live with no rebuild/deploy. Keeping
-- every row gives version history + one-click rollback (delete the bad row and
-- the previous release becomes current again).
--
-- Only the server (service-role) ever reads/writes this table, so RLS is enabled
-- with NO policies — that denies all anon/authenticated access while the
-- service-role key (used by the Express layer) bypasses RLS entirely. The public
-- "latest" read is done server-side with the service-role client.
-- ============================================================================

create table if not exists public.app_releases (
  id            uuid primary key default gen_random_uuid(),
  version_name  text not null,                         -- human version, e.g. "1.0.3"
  file_name     text not null,                         -- original/object basename
  storage_path  text not null,                         -- object key within the bucket
  file_size     bigint not null default 0,             -- bytes
  notes         text,                                  -- optional release notes
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- The download endpoints sort by created_at desc to find the current release.
create index if not exists app_releases_created_at_idx
  on public.app_releases (created_at desc);

-- Lock the table: RLS on, no policies → only the service-role client (server)
-- can touch it. Students never query this directly.
alter table public.app_releases enable row level security;
