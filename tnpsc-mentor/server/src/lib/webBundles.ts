import { config } from '../config.js'
import { supabaseAdmin } from '../supabase.js'

// Self-hosted live-update (OTA) server for @capgo/capacitor-updater. The
// installed app ships the `dist` build inside the store binary; this lets a
// newer `dist` zip reach devices without a Play/App Store review, which is the
// whole point — see supabase/web_bundles.sql for the registry and the policy on
// what still needs a real store release (anything native).
//
// Public Storage bucket holding the uploaded zips. Created once by
// server/setup-web-bundles.mjs (idempotent).
export const BUNDLE_BUCKET = 'web-bundles'

const STORAGE_BASE = `${config.supabaseUrl.replace(/\/$/, '')}/storage/v1/object`

/** Public CDN URL for an object in the bundle bucket. */
export function bundlePublicUrl(storagePath: string): string {
  return `${STORAGE_BASE}/public/${BUNDLE_BUCKET}/${storagePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}

/** The plugin's reserved name for the assets baked into the store build. */
export const BUILTIN = 'builtin'

export interface WebBundleRow {
  id: string
  version: string
  channel: string
  min_version_build: string
  max_version_build: string | null
  rollout_percent: number
  file_name: string
  storage_path: string
  file_size: number
  checksum: string
  notes: string | null
  active: boolean
  created_by: string | null
  created_at: string
}

/**
 * Compare dotted version strings numerically (1 if a>b, -1 if a<b, 0 if equal).
 * Missing/garbage segments count as 0, so "2.0" and "2.0.0" are equal. Same
 * rules as compareVersions() in src/lib/appUpdate.ts — these two must agree,
 * since one gates the APK prompt and the other gates the bundle.
 */
export function compareBuild(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

/**
 * Stable 0..99 bucket for a device, so a staged rollout keeps the SAME devices
 * in the early group as the percentage climbs (a random draw per check would
 * flip devices in and out of the update on every foreground). FNV-1a over the
 * plugin's device id; unknown/blank ids land in bucket 0, i.e. they update
 * first — deliberate, since that is also what an emulator or a reinstall looks
 * like, and there are very few of them.
 */
export function rolloutBucket(deviceId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < deviceId.length; i++) {
    h ^= deviceId.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 100
}

export interface BundleQuery {
  /** Device's NATIVE versionName (the plugin sends this as `version_build`). */
  versionBuild: string
  /** Plugin's stable per-install id; drives the staged-rollout bucket. */
  deviceId: string
  channel?: string
}

/**
 * The bundle a given device should be running, or null when it should fall back
 * to the store-shipped assets. Newest active row wins among those whose native
 * window contains the device's build and whose rollout bucket includes it.
 */
export async function pickBundle({
  versionBuild,
  deviceId,
  channel = 'production',
}: BundleQuery): Promise<WebBundleRow | null> {
  // No usable native version means we cannot prove a bundle is safe for this
  // build — answer builtin rather than guess.
  if (!versionBuild.trim()) return null

  const { data, error } = await supabaseAdmin
    .from('web_bundles')
    .select('*')
    .eq('active', true)
    .eq('channel', channel)
    .order('created_at', { ascending: false })
  if (error) throw error

  const bucket = rolloutBucket(deviceId)
  return (
    (data as WebBundleRow[]).find(
      (b) =>
        compareBuild(versionBuild, b.min_version_build) >= 0 &&
        (!b.max_version_build || compareBuild(versionBuild, b.max_version_build) <= 0) &&
        bucket < b.rollout_percent
    ) ?? null
  )
}
