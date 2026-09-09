// ─── Server-driven UI: validation ────────────────────────────────────────────
// Everything arriving from the network passes through here before it can reach
// a component. The rule is that a layout is either safe and complete, or it is
// not used at all — a half-validated tree is how SDUI turns into a white screen
// on someone's phone in the middle of a test.
//
// Two different failure modes, handled deliberately differently:
//
//   • STRUCTURAL problems (not an object, too deep, too many nodes, a cycle)
//     reject the whole layout → the caller falls back to the built-in screen.
//   • An UNKNOWN node type drops just that node and keeps its siblings. This is
//     what lets the console publish one layout for the whole fleet: a build that
//     predates a component simply omits it, instead of every older install
//     losing the screen. Same forward-compatibility contract as an unknown
//     field in a JSON API.
//
// A mirrored copy of these rules runs server-side before a row is saved
// (server/src/lib/sdui.ts) so bad layouts are caught at authoring time, not on
// a student's phone. The two must agree — change both.

import {
  SDUI_MAX_DEPTH,
  SDUI_MAX_NODES,
  SDUI_MAX_TEXT,
  type SduiAction,
  type SduiLayout,
  type SduiNode,
  type SduiSheetId,
  type SduiWhen,
} from './types'

/**
 * Node types the renderer knows. The registry is asserted against this list at
 * module load (registry.tsx), so adding a component without listing it here —
 * or listing one that doesn't exist — is a type error rather than a runtime
 * mystery.
 */
export const SDUI_NODE_TYPES = [
  // Layout
  'stack',
  'row',
  'grid',
  'section',
  'spacer',
  'divider',
  // Content
  'text',
  'heading',
  'image',
  'icon',
  'badge',
  'stat',
  'progress',
  // Interactive
  'button',
  'card',
  'card_row',
  'grid_card',
  'list',
  'list_row',
  'banner',
  'hero',
] as const

export type SduiNodeType = (typeof SDUI_NODE_TYPES)[number]

const NODE_TYPES = new Set<string>(SDUI_NODE_TYPES)

const ACTION_KINDS = new Set(['none', 'navigate', 'open_url', 'upsell', 'sheet', 'track'])
const SHEET_IDS = new Set(['daily_ca', 'ca_hub', 'thirukural', 'flashcards'])
const UPSELL_PLANS = new Set(['credits', 'premium', 'bundle'])

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

const WHEN_OPS = new Set([
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'nin',
  'truthy',
  'falsy',
  'version_gte',
  'version_lt',
])

/**
 * Hosts an `open_url` action may point at. An SDUI row is edited by a human in
 * a console and stored in a database — both of which can be wrong — so the one
 * action that can take a user OFF our surfaces is the one that gets a list.
 * Subdomains of these hosts are allowed; lookalikes ("tnpscmentors.in.evil.com")
 * are not, because the check is a suffix match on a dot boundary.
 */
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

/** Route prefixes a `navigate` action may target — the app's own screens only.
 *  Anything else is treated as a typo and the action is dropped (the node still
 *  renders, it just does nothing, which is far better than navigating somewhere
 *  unexpected mid-session). */
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
  '/group-2-test-series',
  '/flashcards',
  '/s/',
  '/privacy',
  '/guidelines',
  '/payment-policy',
  '/refund-policy',
]

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** True when `url` is https and its host is (a subdomain of) an allowed host. */
export function isAllowedUrl(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  return URL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

/** True when `to` is one of the app's own routes. */
export function isAllowedRoute(to: string): boolean {
  if (!to.startsWith('/')) return false
  // Reject anything with a scheme or a protocol-relative prefix smuggled in.
  if (to.startsWith('//') || to.includes(':')) return false
  return NAV_PREFIXES.some((p) => to === p || to.startsWith(p))
}

/** Clean an action, or null if it is unusable. A dropped action leaves the node
 *  rendered but inert. */
function cleanAction(raw: unknown): SduiAction | null {
  if (!isPlainObject(raw)) return null
  const kind = raw.kind
  if (typeof kind !== 'string' || !ACTION_KINDS.has(kind)) return null

  switch (kind) {
    case 'none':
      return { kind: 'none' }
    case 'navigate': {
      const to = typeof raw.to === 'string' ? raw.to.trim() : ''
      if (!isAllowedRoute(to)) return null
      // `state` rides along to the target screen (a QuizConfig, a preselected
      // tab). Kept to plain JSON one level deep — it is handed to a React
      // Router location, not executed.
      const state = isPlainObject(raw.state) ? (raw.state as Record<string, unknown>) : undefined
      return state ? { kind: 'navigate', to, state } : { kind: 'navigate', to }
    }
    case 'open_url': {
      const url = typeof raw.url === 'string' ? raw.url.trim() : ''
      return isAllowedUrl(url) ? { kind: 'open_url', url } : null
    }
    case 'upsell': {
      const plan = typeof raw.plan === 'string' && UPSELL_PLANS.has(raw.plan) ? raw.plan : undefined
      return { kind: 'upsell', plan: plan as 'credits' | 'premium' | 'bundle' | undefined }
    }
    case 'sheet': {
      const id = typeof raw.id === 'string' && SHEET_IDS.has(raw.id) ? raw.id : ''
      return id ? { kind: 'sheet', id: id as SduiSheetId } : null
    }
    case 'track': {
      const event = typeof raw.event === 'string' ? raw.event.trim().slice(0, 60) : ''
      if (!event) return null
      const params: Record<string, string | number | boolean> = {}
      if (isPlainObject(raw.params)) {
        for (const [k, v] of Object.entries(raw.params)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            params[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 100) : v
          }
        }
      }
      return { kind: 'track', event, params }
    }
    default:
      return null
  }
}

/** Clean a visibility rule, or null (which the evaluator reads as "always
 *  show" — a malformed condition must never hide content silently). */
function cleanWhen(raw: unknown, depth = 0): SduiWhen | null {
  if (!isPlainObject(raw) || depth > SDUI_MAX_DEPTH) return null

  const out: SduiWhen = {}
  for (const combinator of ['all', 'any'] as const) {
    const list = raw[combinator]
    if (Array.isArray(list)) {
      const kids = list.map((c) => cleanWhen(c, depth + 1)).filter((c): c is SduiWhen => c !== null)
      if (kids.length) out[combinator] = kids
    }
  }
  if (raw.not !== undefined) {
    const n = cleanWhen(raw.not, depth + 1)
    if (n) out.not = n
  }

  if (typeof raw.field === 'string' && WHEN_FIELDS.has(raw.field)) {
    const op = typeof raw.op === 'string' && WHEN_OPS.has(raw.op) ? raw.op : 'truthy'
    out.field = raw.field as SduiWhen['field']
    out.op = op as SduiWhen['op']
    const v = raw.value
    if (Array.isArray(v)) {
      out.value = v.filter((x) => typeof x === 'string' || typeof x === 'number') as Array<
        string | number
      >
    } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out.value = v
    }
  }

  return Object.keys(out).length ? out : null
}

/** Props are passed to a component, so they are clamped rather than trusted:
 *  strings are length-capped, and only JSON-ish values survive. Per-type prop
 *  meaning is the registry's business; this is the blanket safety pass. */
function cleanProps(raw: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!isPlainObject(raw) || depth > 3) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k.length > 40) continue
    if (typeof v === 'string') out[k] = v.slice(0, SDUI_MAX_TEXT)
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v
    else if (Array.isArray(v)) {
      out[k] = v
        .slice(0, 60)
        .map((x) =>
          typeof x === 'string'
            ? x.slice(0, SDUI_MAX_TEXT)
            : isPlainObject(x)
              ? cleanProps(x, depth + 1)
              : typeof x === 'number' || typeof x === 'boolean'
                ? x
                : null
        )
        .filter((x) => x !== null)
    } else if (isPlainObject(v)) {
      const nested = cleanProps(v, depth + 1)
      if (nested) out[k] = nested
    }
  }
  return out
}

interface CleanCtx {
  count: number
  dropped: string[]
}

function cleanNode(raw: unknown, depth: number, ctx: CleanCtx): SduiNode | null {
  if (!isPlainObject(raw)) return null
  if (depth > SDUI_MAX_DEPTH) return null
  if (ctx.count >= SDUI_MAX_NODES) return null

  const type = typeof raw.type === 'string' ? raw.type.trim() : ''
  if (!type) return null
  // Forward compatibility: a type this build doesn't have is skipped, not fatal.
  if (!NODE_TYPES.has(type)) {
    ctx.dropped.push(type)
    return null
  }

  ctx.count++

  const node: SduiNode = { type }
  if (typeof raw.key === 'string' && raw.key.trim()) node.key = raw.key.trim().slice(0, 60)

  const props = cleanProps(raw.props)
  if (props && Object.keys(props).length) node.props = props

  const when = cleanWhen(raw.when)
  if (when) node.when = when

  const action = cleanAction(raw.action)
  if (action) node.action = action

  if (Array.isArray(raw.children)) {
    const kids = raw.children
      .map((c) => cleanNode(c, depth + 1, ctx))
      .filter((c): c is SduiNode => c !== null)
    if (kids.length) node.children = kids
  }

  return node
}

export interface SanitizeResult {
  layout: SduiLayout | null
  /** Unknown node types encountered — reported once so the console can show
   *  "this layout uses a component 2.0.6 devices don't have". */
  droppedTypes: string[]
}

/**
 * Turn anything off the wire into a layout that is safe to render, or null.
 * Never throws: a parse failure is a fallback, not a crash.
 */
export function sanitizeLayout(raw: unknown): SanitizeResult {
  const ctx: CleanCtx = { count: 0, dropped: [] }
  if (!isPlainObject(raw)) return { layout: null, droppedTypes: [] }

  const key = typeof raw.key === 'string' ? raw.key.trim() : ''
  if (!key) return { layout: null, droppedTypes: [] }

  const nodesRaw = Array.isArray(raw.nodes) ? raw.nodes : null
  if (!nodesRaw) return { layout: null, droppedTypes: [] }

  const nodes = nodesRaw.map((n) => cleanNode(n, 0, ctx)).filter((n): n is SduiNode => n !== null)

  // Every node was unusable — treat as "the server has nothing for this slot"
  // rather than rendering an empty container where a banner used to be.
  if (!nodes.length) return { layout: null, droppedTypes: [...new Set(ctx.dropped)] }

  const revision = Number(raw.revision)
  return {
    layout: {
      key: key.slice(0, 80),
      revision: Number.isFinite(revision) ? revision : 0,
      title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : undefined,
      nodes,
    },
    droppedTypes: [...new Set(ctx.dropped)],
  }
}
