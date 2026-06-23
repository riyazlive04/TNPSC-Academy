import { Router } from 'express'
import { asyncH } from '../util.js'
import { apkPublicUrl, currentRelease } from '../lib/appReleases.js'

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

export default router
