// ─── Server-driven UI: the wire schema ───────────────────────────────────────
// A screen is a tree of nodes. The server sends the tree, the client maps each
// node's `type` onto a real component from the registry (components/Sdui/
// registry.tsx) and renders it. Nothing here is code — no expressions, no
// handlers, no HTML. That is deliberate: a layout is DATA, so a compromised or
// simply wrong row can never do more than draw a bad screen.
//
// How this differs from the OTA bundle (docs/LIVE-UPDATES.md): a live bundle
// replaces the whole `dist` and every device downloads ~12 MB; SDUI changes one
// screen's arrangement in a ~2 KB JSON read, can be targeted per audience, and
// is edited in the console rather than rebuilt. They stack — SDUI arranges the
// components a given store/OTA build knows how to draw.

/**
 * A user-facing string. Either one string (shown in every language) or the
 * bilingual pair the rest of the app uses. Resolved against the language store
 * at render time, so the same row serves an English and a Tamil reader.
 */
export type SduiText = string | { en: string; ta?: string }

/** Fields a `when` clause may test. Deliberately a closed list: the evaluator
 *  reads ONLY these, so a layout can never reach into arbitrary app state. */
export type SduiField =
  | 'lang' // 'en' | 'ta' | 'both'
  | 'platform' // 'web' | 'android' | 'ios'
  | 'app_version' // native versionName, e.g. '2.0.7' (compared numerically)
  | 'role' // 'user' | 'admin' | 'superadmin' | 'telecaller'
  | 'premium'
  | 'vettri'
  | 'unlimited' // premium || vettri
  | 'rank_booster'
  | 'mock_pack'
  | 'signed_in'
  | 'credits'
  | 'tests_taken'
  | 'streak'
  | 'days_since_signup'
  | 'hour' // 0-23, IST — for "study tonight" style copy

export type SduiOp =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'nin'
  | 'truthy'
  | 'falsy'
  /** Dotted-version compare against `app_version` (2.0.10 > 2.0.9). */
  | 'version_gte'
  | 'version_lt'

/**
 * Visibility rule on a node. Leaf form is `{ field, op, value }`; the three
 * combinators nest. An absent `when` means "always show".
 */
export interface SduiWhen {
  all?: SduiWhen[]
  any?: SduiWhen[]
  not?: SduiWhen
  field?: SduiField
  op?: SduiOp
  value?: string | number | boolean | Array<string | number>
}

/**
 * What a tap does. Every kind is handled by a fixed dispatcher
 * (lib/sdui/actions.ts) — the server picks from this menu, it does not supply
 * behaviour. `navigate` targets are checked against the app's real route table
 * and `open_url` hosts against an allowlist, so neither can be pointed at an
 * attacker's page.
 */
export type SduiAction =
  | { kind: 'none' }
  | { kind: 'navigate'; to: string; state?: Record<string, unknown> }
  | { kind: 'open_url'; url: string }
  | { kind: 'upsell'; plan?: 'credits' | 'premium' | 'bundle' }
  | { kind: 'sheet'; id: SduiSheetId }
  | { kind: 'track'; event: string; params?: Record<string, string | number | boolean> }

/** Local sheets/modals a layout may open. Closed list, same reasoning as fields. */
export type SduiSheetId = 'daily_ca' | 'ca_hub' | 'thirukural' | 'flashcards'

/** One node in the tree. `props` is validated per type by the registry entry. */
export interface SduiNode {
  type: string
  /** Stable key for React and for analytics ("which banner was tapped"). */
  key?: string
  props?: Record<string, unknown>
  children?: SduiNode[]
  when?: SduiWhen
  /** Fired when this node is tapped, if its component is interactive. */
  action?: SduiAction
}

/** A screen (or slot) as delivered. `nodes` is the tree; everything else is
 *  provenance the client echoes back in analytics and error reports. */
export interface SduiLayout {
  /** Slot/screen name, e.g. 'home.top' or 'screen.offers'. */
  key: string
  /** Monotonic per key — lets the client keep the newer of cache vs. network. */
  revision: number
  /** Free-text label shown in the console, never to a user. */
  title?: string
  nodes: SduiNode[]
}

/** What GET /api/app/sdui returns. `layouts` is keyed by slot name; a key the
 *  server has nothing for is simply absent, and the client draws its built-in. */
export interface SduiResponse {
  layouts: Record<string, SduiLayout>
  /** Server clock, so a client with a wrong date still ages its cache right. */
  fetched_at: string
}

// ─── Limits ──────────────────────────────────────────────────────────────────
// Enforced by validate.ts on the client AND by the server before a row is saved.
// A layout that trips one of these is rejected whole rather than half-drawn.

/** Deepest nesting a layout may use. Guards against a tree that stack-overflows
 *  the renderer (and against a console typo pasting a layout into itself). */
export const SDUI_MAX_DEPTH = 12
/** Total nodes in one layout. A screen this big is a bug, not a design. */
export const SDUI_MAX_NODES = 400
/** Longest a single piece of copy may be — a paragraph, not a document. */
export const SDUI_MAX_TEXT = 2000
