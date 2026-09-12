import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { asyncH } from '../util.js'
import { apkPublicUrl, currentRelease } from '../lib/appReleases.js'
import { BUILTIN, bundlePublicUrl, pickBundle } from '../lib/webBundles.js'
import { pickLayouts, toWireLayout } from '../lib/sdui.js'
import { readPublicSettings } from '../lib/settings.js'

// Public (unauthenticated) app-distribution routes. The landing page — served on
// a different origin (main domain) than this API (app subdomain) — calls these
// to surface the current Android build.
const router = Router()

// ─── GET /api/app/latest ─────────────────────────────────────────────────────
// Metadata for the current APK (or { release: null } when none uploaded yet).
router.get(
  '/latest',
  asyncH(async (_req, res) => {
    const r = await currentRelease()
    if (!r) return res.json({ release: null })
    res.json({
      release: {
        version_name: r.version_name,
        file_name: r.file_name,
        file_size: r.file_size,
        notes: r.notes,
        created_at: r.created_at,
        url: apkPublicUrl(r.storage_path),
      },
    })
  })
)

// ─── GET /api/app/download ───────────────────────────────────────────────────
// Stable, shareable download link → 302-redirects to the current APK's public
// CDN URL. 404 (JSON) when no build has been uploaded yet. Always serves the
// newest upload, so QR codes / marketing links never need updating.
router.get(
  '/download',
  asyncH(async (_req, res) => {
    const r = await currentRelease()
    if (!r) return res.status(404).json({ error: 'No app build is available yet.' })
    res.redirect(302, apkPublicUrl(r.storage_path))
  })
)

// ─── POST /api/app/web-bundle/check ──────────────────────────────────────────
// Self-hosted live-update endpoint for @capgo/capacitor-updater (configured as
// `updateUrl` in capacitor.config.ts). The plugin POSTs its device/app info on
// every foreground and expects one of:
//   • { version, url, checksum }  — download this bundle and apply it
//   • { version: 'builtin' }      — drop back to the assets inside the store build
//   • { version, kind: 'up_to_date', message } — nothing to do
// Anything else (or an unreachable server) leaves the running bundle alone, so
// a failure here can never brick the app.
//
// Unauthenticated by necessity — the check happens before/without a session —
// so it is rate-limited per IP. A device checks once per foreground; the cap is
// far above that but well under what a script could use to enumerate bundles.
const bundleCheckLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'too_many_requests', message: 'Too many update checks.' },
})

router.post(
  '/web-bundle/check',
  bundleCheckLimiter,
  asyncH(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : '')
    // `version_build` is the NATIVE versionName; `version_name` is the web
    // bundle currently running ('builtin' on a fresh install).
    const versionBuild = str('version_build')
    const current = str('version_name') || BUILTIN
    const deviceId = str('device_id')

    const upToDate = (version: string) =>
      res.json({ version, kind: 'up_to_date', message: 'No new version available' })

    let bundle = null
    try {
      bundle = await pickBundle({ versionBuild, deviceId })
    } catch (e) {
      // A DB blip must not read as "roll back to builtin" — say nothing changed.
      console.error('[web-bundle check]', e)
      return upToDate(current)
    }

    // Nothing targets this build (or the row was deactivated): send it home to
    // the store-shipped assets. Devices already there need no instruction.
    if (!bundle) return current === BUILTIN ? upToDate(current) : res.json({ version: BUILTIN })

    if (bundle.version === current) return upToDate(current)

    res.json({
      version: bundle.version,
      url: bundlePublicUrl(bundle.storage_path),
      checksum: bundle.checksum,
      message: bundle.notes ?? '',
    })
  })
)

// ─── GET /api/app/sdui ───────────────────────────────────────────────────────
// Every published server-driven layout this device should render, keyed by slot
// (see src/lib/sdui/ and docs/SDUI.md). The client fetches this once per launch
// and caches it, so a screen with several server-driven regions costs one small
// request rather than one per region.
//
// Unauthenticated on purpose: layouts are the same for everyone in a given
// platform/version/rollout group, and audience targeting (paid vs. free, Tamil
// vs. English) happens on the DEVICE against state it already holds. That keeps
// this endpoint cacheable and means the login and landing screens can carry a
// server-driven slot too. Nothing user-specific is ever in a response.
//
// A failure answers an empty set rather than an error: every slot falls back to
// the UI baked into the build, which is exactly what shipped before any layout
// existed.
const sduiLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'too_many_requests', message: 'Too many layout checks.' },
})

router.get(
  '/sdui',
  sduiLimiter,
  asyncH(async (req, res) => {
    const platform = String(req.query.platform ?? 'web').slice(0, 16)
    const version = String(req.query.v ?? '').slice(0, 24)
    const deviceId = String(req.query.device ?? '').slice(0, 64)

    let layouts: Record<string, ReturnType<typeof toWireLayout>> = {}
    try {
      const rows = await pickLayouts({ platform, version, deviceId })
      layouts = Object.fromEntries(
        Object.entries(rows).map(([key, row]) => [key, toWireLayout(row)])
      )
    } catch (e) {
      // A DB blip must not blank a dashboard — answer "nothing published".
      console.error('[sdui]', e)
    }

    // Short shared cache: a publish should reach devices in about a minute,
    // and this endpoint is hit on every launch by every install.
    res.set('Cache-Control', 'public, max-age=60')
    res.json({ layouts, fetched_at: new Date().toISOString() })
  })
)

// ─── GET /api/app/settings ───────────────────────────────────────────────────
// Public, client-facing feature flags (e.g. which Mock Test sections are shown).
// Defaults are applied server-side so the client always gets a complete object.
router.get(
  '/settings',
  asyncH(async (_req, res) => {
    res.json({ settings: await readPublicSettings() })
  })
)

export default router
