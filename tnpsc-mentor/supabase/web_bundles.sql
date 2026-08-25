-- ============================================================================
-- TNPSC Mentors — live web-bundle (OTA) registry
-- ----------------------------------------------------------------------------
-- The installed app is a Capacitor WebView serving the `dist` build baked into
-- the AAB/APK, so until now EVERY UI change — including content-shaped ones
-- like a new PYQ group or a new Tamil label — needed a Play release and its
-- 3-7 day review. @capgo/capacitor-updater lets the app fetch a newer `dist`
-- zip at runtime and swap it on next background, keeping the store build as
-- the permanent fallback. This table is the self-hosted update server's
-- registry: superadmins upload a zip from the console, the object goes to the
-- public `web-bundles` Storage bucket, and one row is recorded per upload.
--
-- What still needs a real store release: anything native — a new Capacitor
-- plugin, a permission, targetSdk, versionCode. Web assets only, here.
--
-- Row selection (see server/src/lib/webBundles.ts): the NEWEST active row whose
-- native-version window contains the requesting build and whose rollout bucket
-- includes the device. No match → the server answers "builtin", which pulls
-- devices back to the bundle shipped inside the store build. That is the kill
-- switch: deactivate the row and the fleet reverts on next foreground.
--
-- Only the server (service-role) ever reads/writes this table, so RLS is on
-- with NO policies — that denies all anon/authenticated access while the
-- service-role key used by the Express layer bypasses RLS entirely. The public
-- update-check endpoint reads it server-side with that client.
-- ============================================================================

create table if not exists public.web_bundles (
  id                uuid primary key default gen_random_uuid(),

  -- Bundle identity handed to the device. The plugin treats this as an opaque
  -- name (it downloads whenever it differs from the running one), so it does
  -- NOT have to be semver — "2.0.5+w3" style is what the console suggests.
  -- 'builtin' is reserved by the plugin for the store-shipped assets.
  version           text not null unique check (version <> 'builtin' and length(btrim(version)) > 0),

  -- Reserved for future parallel tracks (beta/staff). The check endpoint
  -- currently serves 'production' only.
  channel           text not null default 'production',

  -- Native-version window, compared against the device's versionName. A bundle
  -- built after a plugin was added must never reach an older store build that
  -- lacks it — that is what min_version_build enforces. max is normally null.
  min_version_build text not null,
  max_version_build text,

  -- Staged rollout: OTA has no Play-style percentage rollout, so we do our own.
  -- The device's stable id is hashed into 0..99 and compared with this.
  rollout_percent   smallint not null default 100 check (rollout_percent between 0 and 100),

  file_name         text not null,               -- original/object basename
  storage_path      text not null,               -- object key within the bucket
  file_size         bigint not null default 0,   -- bytes
  checksum          text not null,               -- sha256 hex of the zip; the plugin verifies it
  notes             text,                        -- what changed, for the console list

  -- Deactivating is the rollback: the next check answers 'builtin' (or the
  -- previous active bundle, if one still matches).
  active            boolean not null default true,

  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- The check endpoint scans active rows newest-first.
create index if not exists web_bundles_created_at_idx
  on public.web_bundles (created_at desc);

-- Lock the table: RLS on, no policies → only the service-role client (server)
-- can touch it.
alter table public.web_bundles enable row level security;
