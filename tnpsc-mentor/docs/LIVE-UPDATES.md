# Live updates (OTA): shipping the app without a store review

The installed app is a Capacitor WebView running the `dist` build baked into the
AAB/IPA. That meant **every** change — a new screen, a Tamil label, a copy fix —
waited on a Play review (3-7 days in practice). It no longer does.

`@capgo/capacitor-updater` now asks **our own server** for a newer `dist` zip,
downloads it in the background and swaps it in the next time the app goes to
background. Capgo's cloud is not involved: `updateUrl` points at
`/api/app/web-bundle/check` and `statsUrl` is empty, so no device data leaves
our infrastructure.

## What can ship this way, and what cannot

| Change | How it ships |
| --- | --- |
| Screens, components, copy, styles, bug fixes | **Live update** — minutes |
| Client-side taxonomy: `PYQ_GROUPS`, Tamil label maps, topic ordering, blueprints | **Live update** |
| New questions / banks / CA / test-series rows | Nothing to ship — already served from the API |
| A new Capacitor plugin, a permission, `targetSdk`, `versionCode`, splash/icon | **Store release** (AAB/IPA) |

A bundle built after a native plugin was added must never reach an older store
build that lacks it. That is what **minimum app version** on every bundle
enforces — set it to the versionName of the release the bundle was built
against.

## Cutting and publishing a bundle

```bash
npm run build                    # the same dist the website gets
npm run bundle:pack 2.0.6+w1     # → dist-bundles/tnpsc-web-2.0.6+w1.zip (+ sha256)
```

Then in **Superadmin → App → Live updates**:

1. **Bundle version** — anything unique and readable; `<app version>+w<n>` keeps
   it obvious which store build it belongs to. `builtin` is reserved.
2. **Minimum app version** — the versionName this bundle was built against
   (e.g. `2.0.6`). Older installs stay on their own assets.
3. **Rollout %** — start at 10-20%. Devices are bucketed by a stable hash of
   their install id, so raising the percentage only ever *adds* devices.
4. Upload the zip. The server computes the sha256 itself; the plugin refuses a
   bundle whose bytes don't match.

Devices pick it up on their next foreground check and apply it when they next
background the app — never mid-session, because a reload during a proctored
mock test would register as a violation.

## Rolling back

**Pause** the bundle in the console. The next check answers `builtin` and every
device reverts to the assets inside its store build. Prefer pausing over
deleting: deleting also removes the zip, so a download still in flight fails.

Two automatic safety nets sit underneath that:

- A bundle that fails to boot never calls `notifyAppReady()`
  (`src/lib/liveUpdate.ts`), so after `appReadyTimeout` (15s) the plugin
  restores the previous bundle by itself.
- `resetWhenUpdate: true` wipes downloaded bundles whenever the app is updated
  from the store, so an old bundle can never sit on top of a newer binary.

Boot and download failures are reported to the existing client-error pipe, so
they show up in the same Telegram feed as crashes.

## How it fits together

| Piece | Where |
| --- | --- |
| Plugin config (`updateUrl`, `autoUpdate: 'atBackground'`, timeouts) | `capacitor.config.ts` |
| `notifyAppReady()` + failure reporting | `src/lib/liveUpdate.ts`, called from `useNativeBootstrap` |
| Update-check endpoint (the plugin's contract) | `server/src/routes/app.ts` → `POST /api/app/web-bundle/check` |
| Bundle selection: version window + rollout bucket | `server/src/lib/webBundles.ts` |
| Upload / pause / rollout / delete | `server/src/routes/superadmin.ts` → `/api/superadmin/web-bundles` |
| Registry + Storage bucket | `supabase/web_bundles.sql`, `server/setup-web-bundles.mjs` |
| Console UI | `WebBundlesSection` in `src/pages/SuperAdminPage.tsx` |

The endpoint answers one of three things: a bundle to download
(`{version, url, checksum}`), `{version: 'builtin'}` to fall back to the store
build's assets, or `up_to_date`. A DB error or an unreachable server answers
"nothing changed", so a failure here can never brick an installed app.

## Known follow-up

A full bundle is ~12 MB. The plugin also supports a per-file `manifest` in the
check response, which would let a device download only the chunks that actually
changed — worth building if update size becomes a complaint on mobile data.
