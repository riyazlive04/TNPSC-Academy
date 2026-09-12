// ─── Server-driven UI: row selection + authoring-time validation ─────────────
// The registry behind GET /api/app/sdui. A row is one published layout for one
// slot key; the endpoint hands each device the newest active row per key whose
// platform, app-version window and rollout bucket it falls inside.
//
// Selection deliberately mirrors the OTA bundle picker (lib/webBundles.ts) —
// same version-window semantics, same stable rollout hash — because the two are
// solving the same problem at different granularity, and an operator who has
// learned one should not have to learn a second set of rules.
//
// The validation below is a MIRROR of src/lib/sdui/validate.ts. It exists so a
// broken layout is refused when a superadmin clicks Publish, with a message
// they can act on, rather than silently falling back on 40,000 phones. The
// client validates independently and remains the real safety boundary; these
// two must be kept in step.

import { supabaseAdmin } from '../supabase.js'

export interface SduiRow {
  id: string
  key: string
  title: string | null
  platform: string // 'all' | 'android' | 'ios' | 'web'
  min_app_version: string | null
  max_app_version: string | null
  rollout_percent: number
  revision: number
  layout: { nodes: unknown[] } | null
  active: boolean
  notes: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// ─── Schema mirror ───────────────────────────────────────────────────────────

const NODE_TYPES = new Set([
  'stack',
  'row',
  'grid',
  'section',
  'spacer',
  'divider',
  'text',
  'heading',
  'image',
  'icon',
  'badge',
  'stat',
  'progress',
  'button',
  'card',
  'card_row',
  'grid_card',
  'list',
  'list_row',
  'banner',
  'hero',
])

const ACTION_KINDS = new Set(['none', 'navigate', 'open_url', 'upsell', 'sheet', 'track'])

const WHEN_FIELDS = new Set([
  'lang',
  'platform',
  'app_version',
  'role',
  'premium',
  'vettri',
  'unlimited',
  'rank_booster',
  'mock_pack',
  'signed_in',
  'credits',
  'tests_taken',
  'streak',
  'days_since_signup',
  'hour',
])

const URL_HOSTS = [
  'tnpscmentors.in',
  'youtube.com',
  'youtu.be',
  'wa.me',
  'whatsapp.com',
  't.me',
  'telegram.me',
  'razorpay.com',
  'play.google.com',
  'apps.apple.com',
]

const NAV_PREFIXES = [
  '/test-arena',
  '/quiz/instructions',
  '/mock',
  '/test-series',
  '/vettri',
  '/materials',
  '/revision',
  '/insights',
  '/profile',
  '/bookmarks',
  '/messages',
  '/daily',
  '/setup',
  '/rank-booster',
  '/mock-test-pack',
  '/flashcards',
  '/s/',
  '/privacy',
  '/guidelines',
  '/payment-policy',
  '/refund-policy',
]

const MAX_DEPTH = 12
const MAX_NODES = 400

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Check a layout being published. Returns the problems found, empty when the
 * layout is good. Reports EVERY problem rather than the first, so an author
 * fixes one round of errors instead of playing whack-a-mole with Publish.
 */
export function validateLayout(raw: unknown): string[] {
  const errors: string[] = []
  if (!isObj(raw)) return ['Layout must be a JSON object.']

  const nodes = (raw as { nodes?: unknown }).nodes
  if (!Array.isArray(nodes) || !nodes.length) {
    return ['Layout needs a non-empty "nodes" array.']
  }

  let count = 0

  const walk = (node: unknown, depth: number, path: string) => {
    if (errors.length > 40) return // Stop piling on; the author has enough.
    if (!isObj(node)) {
      errors.push(`${path}: each node must be an object.`)
      return
    }
    if (depth > MAX_DEPTH) {
      errors.push(`${path}: nesting deeper than ${MAX_DEPTH} levels.`)
      return
    }
    if (++count > MAX_NODES) {
      errors.push(`Layout has more than ${MAX_NODES} nodes.`)
      return
    }

    const type = node.type
    if (typeof type !== 'string' || !NODE_TYPES.has(type)) {
      errors.push(`${path}: unknown component "${String(type)}".`)
    }

    if (node.action !== undefined) {
      const a = node.action
      if (!isObj(a) || typeof a.kind !== 'string' || !ACTION_KINDS.has(a.kind)) {
        errors.push(`${path}: action must have a known "kind".`)
      } else if (a.kind === 'navigate') {
        const to = typeof a.to === 'string' ? a.to : ''
        if (!NAV_PREFIXES.some((p) => to === p || to.startsWith(p))) {
          errors.push(`${path}: "${to}" is not an in-app route.`)
        }
      } else if (a.kind === 'open_url') {
        const url = typeof a.url === 'string' ? a.url : ''
        let ok = false
        try {
          const u = new URL(url)
          const host = u.hostname.toLowerCase()
          ok = u.protocol === 'https:' && URL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
        } catch {
          ok = false
        }
        if (!ok) errors.push(`${path}: "${url}" is not an allowed https link.`)
      }
    }

    if (node.when !== undefined) validateWhen(node.when, path, errors, 0)

    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) {
        errors.push(`${path}: "children" must be an array.`)
      } else {
        node.children.forEach((c, i) => walk(c, depth + 1, `${path}.children[${i}]`))
      }
    }
  }

  nodes.forEach((n, i) => walk(n, 0, `nodes[${i}]`))
  return errors
}

function validateWhen(when: unknown, path: string, errors: string[], depth: number): void {
  if (depth > MAX_DEPTH) return
  if (!isObj(when)) {
    errors.push(`${path}: "when" must be an object.`)
    return
  }
  for (const k of ['all', 'any'] as const) {
    const list = when[k]
    if (list !== undefined) {
      if (!Array.isArray(list)) errors.push(`${path}: "when.${k}" must be an array.`)
      else list.forEach((c) => validateWhen(c, path, errors, depth + 1))
    }
  }
  if (when.not !== undefined) validateWhen(when.not, path, errors, depth + 1)
  if (when.field !== undefined && (typeof when.field !== 'string' || !WHEN_FIELDS.has(when.field))) {
    errors.push(`${path}: "${String(when.field)}" is not a targetable field.`)
  }
}

// ─── Selection ───────────────────────────────────────────────────────────────

/**
 * Compare dotted version strings numerically. Same rules as compareBuild() in
 * lib/webBundles.ts and compareVersions() in src/lib/appUpdate.ts — all three
 * gate what reaches an older install and must agree.
 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

/** Stable 0..99 bucket for a device (FNV-1a), so raising a rollout percentage
 *  only ever ADDS devices instead of reshuffling which ones are in. */
export function rolloutBucket(deviceId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < deviceId.length; i++) {
    h ^= deviceId.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 100
}

export interface LayoutQuery {
  platform: string
  /** Native versionName; '' on the web build. */
  version: string
  deviceId: string
}

/**
 * Every layout this device should render, keyed by slot. One active row per key
 * wins: the highest revision among those whose platform, version window and
 * rollout bucket all match.
 *
 * A version window is checked ONLY when the device reported a version. The web
 * build reports none, so a row that names a minimum is understood as "native
 * installs from this build onward" and is skipped on web — a layout gated on a
 * component that shipped in 2.0.7 must not land on a browser by default.
 */
export async function pickLayouts({
  platform,
  version,
  deviceId,
}: LayoutQuery): Promise<Record<string, SduiRow>> {
  const { data, error } = await supabaseAdmin
    .from('sdui_screens')
    .select('*')
    .eq('active', true)
    .order('revision', { ascending: false })
  if (error) throw error

  const bucket = rolloutBucket(deviceId)
  const out: Record<string, SduiRow> = {}

  for (const row of (data ?? []) as SduiRow[]) {
    if (out[row.key]) continue // A higher revision already won this key.
    if (row.platform !== 'all' && row.platform !== platform) continue
    if (bucket >= row.rollout_percent) continue
    if (row.min_app_version) {
      if (!version || compareVersion(version, row.min_app_version) < 0) continue
    }
    if (row.max_app_version) {
      if (!version || compareVersion(version, row.max_app_version) > 0) continue
    }
    if (!row.layout || !Array.isArray(row.layout.nodes) || !row.layout.nodes.length) continue
    out[row.key] = row
  }

  return out
}

/** The wire shape for one layout — the row's provenance plus its tree. */
export function toWireLayout(row: SduiRow) {
  return {
    key: row.key,
    revision: row.revision,
    title: row.title ?? undefined,
    nodes: row.layout?.nodes ?? [],
  }
}
