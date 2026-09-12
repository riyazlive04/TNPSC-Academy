# Server-driven UI (SDUI)

Parts of the app are drawn from a layout the **server** sends, not from JSX
compiled into the build. A superadmin edits that layout in the console, publishes
it, and every device picks it up on its next launch — no Play review, no
download, no rebuild.

This sits alongside the OTA channel (`docs/LIVE-UPDATES.md`), and the split
matters:

| | Live update (OTA) | SDUI |
| --- | --- | --- |
| Ships | A whole new `dist` — new components, new logic | An **arrangement** of components the build already has |
| Size | ~12 MB per device | ~2 KB, shared for everyone |
| Authored by | A developer, via `npm run bundle:pack` | A superadmin, in the console |
| Targeting | Version window + rollout % | Version window + rollout % **+ per-user audience on the device** |
| Rollback | Pause the bundle | Pause the layout |
| Reaches devices | Next background | Next launch |

Rule of thumb: **OTA adds the vocabulary, SDUI writes the sentence.** A component
that doesn't exist in a build can never be drawn by a layout, however it is
published.

## What is server-driven today

Three regions of the dashboard, and any number of whole screens:

| Key | Where |
| --- | --- |
| `home.top` | Under the greeting, above the discovery banners. Empty until used. |
| `home.banners` | **Replaces** the Mock Pack / Rank Booster strips. Falls back to them. |
| `home.footer` | Below "Keep going". Empty until used. |
| `screen.<name>` | A whole screen at `/s/<name>` — no route, no page component. |

Adding another region is one line in the page: `<SduiSlot name="…" fallback={…} />`.
With nothing published a slot renders its `fallback`, which is the JSX that was
already there — so adding a slot changes nothing until someone publishes to it.
That is the migration path for the rest of the app: wrap a region, publish a
layout that reproduces it, delete the hand-written copy a release later.

## Publishing

**Superadmin → Screen layouts.**

1. **New layout** → give it a slot key (`home.banners`, or `screen.diwali-offer`).
2. Edit the JSON. The preview beside it renders through the *same* renderer the
   app uses, against *your* account — so a node aimed at free users won't show
   if you're paid.
3. **Save** (still a draft — nothing has reached a device).
4. Set **platform**, **min app version** and **rollout %**.
5. **Publish.**

**Rollback is Pause.** The next launch falls back to the built-in screen. Prefer
it to Delete, which loses the record of what was live.

## The schema

```jsonc
{
  "nodes": [
    {
      "type": "banner",                    // from the registry (below)
      "key": "mock-pack",                  // stable id — used in tap analytics
      "props": {
        "icon": "rocket",
        "tint": "coral",
        "title":    { "en": "Mock Test Pack", "ta": "மாதிரித் தேர்வுத் தொகுப்பு" },
        "subtitle": { "en": "6 papers · ₹399", "ta": "6 தாள்கள் · ₹399" },
        "cta":      { "en": "See the pack",   "ta": "தொகுப்பைப் பார்" }
      },
      "when":   { "field": "mock_pack", "op": "falsy" },
      "action": { "kind": "navigate", "to": "/mock-test-pack" }
    }
  ]
}
```

Any text field takes either a plain string or `{ en, ta }`. Bilingual pairs
follow the app's own rules: `ta` readers get Tamil, `both` readers get
`English / தமிழ்`, and a missing `ta` falls back to English. `{name}` and
`{credits}` are the only tokens interpolated into copy.

### Components

`stack` `row` `grid` `section` `spacer` `divider` · `text` `heading` `image`
`icon` `badge` `stat` `progress` · `button` `card` `card_row` `grid_card` `list`
`list_row` `banner` `hero`

Every one composes the app's own primitives, so a server-driven row is
indistinguishable from a hand-written one. Group rows with `list` and its
`style`: `plain` (hairline list, the default), `card`, or `grid`.

### `when` — who sees it

Leaf: `{ field, op, value }`. Combine with `all` / `any` / `not`.

Fields: `lang` `platform` `app_version` `role` `premium` `vettri` `unlimited`
`rank_booster` `mock_pack` `signed_in` `credits` `tests_taken` `streak`
`days_since_signup` `hour` (IST).

Ops: `eq` `ne` `lt` `lte` `gt` `gte` `in` `nin` `truthy` `falsy` `version_gte`
`version_lt`.

Conditions are evaluated **on the device**, against state it already holds — so
a banner disappears the moment a payment lands, with no reload and no extra
request. `tests_taken`, `streak` and `days_since_signup` are only populated on
screens that already fetch them (the dashboard does); elsewhere they read 0.

### `action` — what a tap does

| kind | |
| --- | --- |
| `navigate` | `to` — an in-app route, checked against the app's real route table |
| `open_url` | `url` — https only, on an allowlisted host |
| `upsell` | `plan`: `credits` \| `premium` \| `bundle` — opens the real paywall |
| `sheet` | `id`: `daily_ca` \| `ca_hub` \| `thirukural` — a sheet the host screen owns |
| `track` | `event` — analytics only |

There is no expression language and no way to supply behaviour: a layout picks
from this menu. Every tap also emits a `sdui_tap` event tagged with the layout
and node key, so "did anyone tap the new banner?" needs no extra instrumentation.

## Safety

The reason this is safe to publish without a review:

- **A layout is data.** No code, no handlers, no HTML. Props are read by name and
  coerced; nothing is spread onto a DOM element.
- **Validated twice** — server-side before a row is saved (with the problems
  listed on the author's screen) and again on the device before it is drawn.
  `src/lib/sdui/validate.ts` and `server/src/lib/sdui.ts` mirror each other and
  must be changed together.
- **Unknown components are dropped, not fatal.** An older build renders the parts
  it knows. Structural problems (too deep, too many nodes, not an object) reject
  the layout whole and fall back.
- **Navigation is allowlisted** to the app's own routes; `/crm` and `/superadmin`
  are not reachable. External links are https-only on known hosts, matched on a
  dot boundary so `tnpscmentors.in.evil.com` fails.
- **Render errors fall back.** The tree renders inside an error boundary that
  swaps in the built-in screen and reports to the same Telegram pipe as a crash.
- **Every failure means "built-in".** Endpoint down, offline, malformed row,
  nothing published — all land on the UI baked into the build.

### The version window is the real guard

`min_app_version` is what keeps a layout naming a component from reaching a build
that lacks it. A layout using something added in 2.0.8 must set `2.0.8`, or older
installs silently drop those nodes. The web build reports no version, so any row
with a minimum is skipped there.

## How it fits together

| Piece | Where |
| --- | --- |
| Schema + limits | `src/lib/sdui/types.ts` |
| Validation / allowlists | `src/lib/sdui/validate.ts` |
| Audience context | `src/lib/sdui/context.ts` |
| `when` + bilingual text | `src/lib/sdui/conditions.ts` |
| Action dispatcher | `src/lib/sdui/actions.ts` |
| Fetch / cache / fallback | `src/lib/sdui/client.ts` |
| Component registry | `src/components/Sdui/registry.tsx` |
| Renderer + error boundary | `src/components/Sdui/SduiRenderer.tsx` |
| Slot | `src/components/Sdui/SduiSlot.tsx` |
| Whole screens (`/s/:key`) | `src/pages/SduiScreenPage.tsx` |
| Read endpoint | `server/src/routes/app.ts` → `GET /api/app/sdui` |
| Selection + server validation | `server/src/lib/sdui.ts` |
| Authoring CRUD | `server/src/routes/superadmin.ts` → `/api/superadmin/sdui` |
| Console UI | `src/components/SuperAdmin/SduiSection.tsx` |
| Table | `supabase/sdui_screens.sql` |

The app fetches every layout in **one** request per launch and caches it, so a
screen with four server-driven regions costs no more than one with a single
region. The endpoint is unauthenticated and `Cache-Control: public, max-age=60`
— nothing user-specific is ever in a response, because targeting happens on the
device.

## Adding a component

1. Add the name to `SDUI_NODE_TYPES` (`src/lib/sdui/validate.ts`) **and** to
   `NODE_TYPES` in `server/src/lib/sdui.ts`.
2. Write the component in `src/components/Sdui/registry.tsx`, reading each prop
   explicitly. The registry is typed as a total map, so a missing entry is a
   build error.
3. Ship it (store release, or OTA bundle).
4. Layouts using it must set `min_app_version` to that release.

## Deploy checklist

- [ ] `supabase/sdui_screens.sql` applied (see the self-hosted DDL path — the
      VPS Postgres is firewalled; run it through Studio's pg-meta endpoint).
- [ ] Server deployed (`GET /api/app/sdui` answers `{"layouts":{}}`).
- [ ] App build ≥ 2.0.7 / versionCode 19 in the store.

Until all three are done, every slot renders its built-in UI — which is exactly
what shipped before. There is no intermediate broken state.
