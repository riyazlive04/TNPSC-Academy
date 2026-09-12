-- ============================================================================
-- TNPSC Mentors — server-driven UI (SDUI) layout registry
-- ----------------------------------------------------------------------------
-- One row = one published layout for one slot. The app asks
-- GET /api/app/sdui on launch and draws whatever comes back in place of the
-- region baked into the build; a slot with no row here renders the built-in UI,
-- which is what every install does until someone publishes.
--
-- Why this exists next to web_bundles (the OTA table): a live bundle replaces
-- the entire `dist` — ~12 MB to every device, all-or-nothing, and it still
-- needs a build step. This changes ONE region's arrangement in a couple of KB,
-- can be aimed at an audience, and is edited in the console. The OTA channel
-- ships new COMPONENTS; this arranges the components a build already has. See
-- docs/SDUI.md.
--
-- Selection (server/src/lib/sdui.ts): among active rows for a key, the highest
-- `revision` whose platform, app-version window and rollout bucket all admit
-- the device. Deactivating the row is the rollback — the next launch falls back
-- to the built-in screen, with no download and no store review.
--
-- Only the server (service-role) reads or writes this table, so RLS is on with
-- NO policies: that denies every anon/authenticated client, while the Express
-- layer's service-role key bypasses RLS. The public read endpoint queries it
-- server-side with that client and returns only the layout tree.
-- ============================================================================

create table if not exists public.sdui_screens (
  id                uuid primary key default gen_random_uuid(),

  -- Slot name the app asks for. Dotted namespace: 'home.banners' is a region
  -- inside a hand-written screen, 'screen.<name>' is a whole screen served at
  -- /s/<name> with no route of its own.
  key               text not null
                      check (key ~ '^[a-z0-9]+(\.[a-z0-9_]+)+$'),

  -- Human label for the console list. Never shown to a user.
  title             text,

  -- 'all' | 'android' | 'ios' | 'web'. A layout that leans on a native-only
  -- action is aimed at one platform rather than hidden with a `when` clause,
  -- so it isn't even delivered to the others.
  platform          text not null default 'all'
                      check (platform in ('all', 'android', 'ios', 'web')),

  -- Native versionName window, compared numerically against what the device
  -- reports. This is the safety rail for the whole system: a layout naming a
  -- component added in 2.0.8 sets min_app_version '2.0.8' and older installs
  -- keep their built-in screen instead of losing the region. The web build
  -- reports no version and is skipped by any row that sets a minimum.
  min_app_version   text,
  max_app_version   text,

  -- Staged rollout, bucketed on a stable hash of the device id — the same
  -- scheme as web_bundles, so raising the number only ever adds devices.
  rollout_percent   smallint not null default 100
                      check (rollout_percent between 0 and 100),

  -- Bumped on every save. The client keeps the higher of cache vs. network,
  -- and among active rows for a key the highest revision wins.
  revision          integer not null default 1,

  -- The tree: { "nodes": [ ... ] }. Validated against the component registry
  -- before it is written (server/src/lib/sdui.ts) AND again on the device
  -- before it is drawn — a row that fails either check falls back rather than
  -- rendering half a screen.
  layout            jsonb not null,

  -- Pausing is the rollback; prefer it to deleting, which loses the history of
  -- what was live when something went wrong.
  active            boolean not null default false,

  notes             text,
  updated_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- The read endpoint scans active rows and takes the newest revision per key.
create index if not exists sdui_screens_key_idx
  on public.sdui_screens (key, revision desc) where active;

-- The console lists everything, newest change first.
create index if not exists sdui_screens_updated_idx
  on public.sdui_screens (updated_at desc);

create or replace function public.touch_sdui_screens()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sdui_screens_touch on public.sdui_screens;
create trigger sdui_screens_touch
  before update on public.sdui_screens
  for each row execute function public.touch_sdui_screens();

-- Lock the table: RLS on, no policies → service-role (the server) only.
alter table public.sdui_screens enable row level security;
