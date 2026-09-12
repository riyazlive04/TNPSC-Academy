// ─── Server-driven UI: fetch, cache and fallback ─────────────────────────────
// One request per app launch fetches every published layout at once (they are a
// couple of KB together), so a screen with four server-driven slots costs no
// more than a screen with one.
//
// The order of preference at render time is: a fresh layout → the last one this
// device saw → the built-in screen. That last step is the important one: this
// build ships BEFORE the endpoint exists on the server, and every slot must
// look exactly as it does today until a layout is actually published. A missing
// key, a 404, an offline launch and a malformed row all land in the same place
// — the hand-written UI — which is why none of them are treated as errors.

import { create } from 'zustand'
import { api } from '../api'
import { getDeviceId } from '../device'
import { sanitizeLayout } from './validate'
import { sduiClientParams } from './context'
import type { SduiLayout } from './types'

const CACHE_KEY = 'tnpsc-mentor-sdui'
/** How long a cached set is served before a background refresh is kicked off. */
const TTL_MS = 10 * 60_000

interface Cached {
  at: number
  layouts: Record<string, SduiLayout>
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cached
    if (!parsed || typeof parsed.at !== 'number' || !parsed.layouts) return null
    // Re-validate on the way OUT of the cache, not just on the way in: this
    // build's rules may be stricter than those of the build that stored it
    // (a route removed, a host dropped from the allowlist).
    const layouts: Record<string, SduiLayout> = {}
    for (const [key, value] of Object.entries(parsed.layouts)) {
      const { layout } = sanitizeLayout(value)
      if (layout) layouts[key] = layout
    }
    return { at: parsed.at, layouts }
  } catch {
    return null
  }
}

function writeCache(layouts: Record<string, SduiLayout>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), layouts } satisfies Cached))
  } catch {
    // Storage full or unavailable (private window, WebView with data blocked).
    // The in-memory copy still serves this session; next launch re-fetches.
  }
}

interface SduiState {
  layouts: Record<string, SduiLayout>
  /** True once a load has finished or failed — slots wait for this before
   *  deciding they have nothing, so a server-driven banner doesn't flash in
   *  after the screen has settled. */
  ready: boolean
  loading: boolean
  load: (opts?: { force?: boolean }) => Promise<void>
}

export const useSduiStore = create<SduiState>((set, get) => ({
  layouts: {},
  ready: false,
  loading: false,

  load: async ({ force = false } = {}) => {
    if (get().loading) return

    // Paint from cache first so a returning user sees the arrangement they had
    // instantly, then refresh behind it.
    if (!get().ready) {
      const cached = readCache()
      if (cached) {
        set({ layouts: cached.layouts, ready: true })
        if (!force && Date.now() - cached.at < TTL_MS) return
      }
    }

    set({ loading: true })
    try {
      const { platform, v } = sduiClientParams()
      const res = await api.sdui({ platform, version: v, deviceId: getDeviceId() })

      const layouts: Record<string, SduiLayout> = {}
      for (const [key, raw] of Object.entries(res.layouts ?? {})) {
        const { layout } = sanitizeLayout(raw)
        // A row that fails validation is skipped, which falls the slot back to
        // its built-in — never renders a partial tree.
        if (layout) layouts[key] = layout
      }

      set({ layouts, ready: true })
      writeCache(layouts)
    } catch {
      // Endpoint not deployed yet, offline, or a server error. Whatever is
      // already in `layouts` (cache or nothing) stands; the UI is unaffected.
      set({ ready: true })
    } finally {
      set({ loading: false })
    }
  },
}))

/** The layout for a slot, or null when the server has nothing for it. */
export function useSduiLayout(key: string): { layout: SduiLayout | null; ready: boolean } {
  const layout = useSduiStore((s) => s.layouts[key] ?? null)
  const ready = useSduiStore((s) => s.ready)
  return { layout, ready }
}
