-- ============================================================================
-- TNPSC Mentors — Materials (study material hub)
-- ----------------------------------------------------------------------------
-- Superadmins curate study material from the console; it surfaces in the app
-- (web + Capacitor Android — one React bundle powers both):
--   • kind='video'    → a YouTube video (only the 11-char video id is stored).
--   • kind='image' | 'pdf' | 'document' → a file uploaded to the private
--     `materials` Storage bucket (storage_path/file_name/file_size/mime_type).
--   • kind='magazine' → a published CA-magazine issue (no file; references the
--     ca_magazine rows by magazine_ca_type + magazine_date — see
--     ca_magazine_publish.sql). Approving an issue in the console inserts one
--     of these; hiding/deleting it unpublishes without touching ca_magazine.
--
-- placement decides WHERE an item shows:
--   • 'profile'   → on the Profile screen, below "How it works" (videos only).
--   • 'materials' → in the Materials/Infographics nav tab (any kind).
--
-- downloadable is a per-item gate: viewing is always allowed in-app, but the
-- "Download" action (a forced-attachment signed URL) is only offered when a
-- superadmin turns this on for that item.
--
-- Like app_releases / thirukural, only the server (service-role) reads/writes
-- this table: RLS is ON with NO policies, so anon/authenticated have no direct
-- access while the service-role key used by the Express layer bypasses RLS. The
-- file bucket is PRIVATE — clients fetch short-lived signed URLs via the API, so
-- the download gate can't be bypassed by sharing a public object URL.
-- Idempotent.
-- ============================================================================

create table if not exists public.materials (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'video'
                 check (kind in ('video', 'image', 'pdf', 'document', 'magazine')),
  placement    text not null default 'materials'
                 check (placement in ('materials', 'profile')),
  title        text not null,
  title_ta     text,
  description  text,
  -- kind='video'
  youtube_id   text,
  -- kind in (image|pdf|document): object in the private `materials` bucket
  storage_path text,
  file_name    text,
  file_size    bigint not null default 0,
  mime_type    text,
  -- kind='magazine': the published ca_magazine issue (soft reference)
  magazine_ca_type text check (magazine_ca_type in ('day_wise', 'month_wise')),
  magazine_date date,
  -- per-item download gate (superadmin enables); viewing is always allowed
  downloadable boolean not null default false,
  active       boolean not null default true,   -- hidden from users when false
  sort_order   int not null default 0,          -- ascending; ties broken by created_at desc
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- The list endpoints filter by placement + active and order by sort_order asc,
-- then created_at desc.
create index if not exists materials_placement_idx
  on public.materials (placement, active, sort_order asc, created_at desc);

-- A magazine issue can be published at most once.
create unique index if not exists materials_magazine_issue_key
  on public.materials (magazine_ca_type, magazine_date)
  where kind = 'magazine';

-- Lock the table: RLS on, no policies → only the service-role client (server)
-- can touch it. Clients always read through /api/materials.
alter table public.materials enable row level security;
