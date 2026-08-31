// ─── Memoised Storage signed URLs ────────────────────────────────────────────
// Signing is cheap; handing out a DIFFERENT URL every time is not. A signed URL
// is a distinct resource to the browser, so re-signing on every request meant a
// reader's cached copy of an image was never reused — every visit re-downloaded
// every thumbnail straight out of Storage. For the CA magazine carousel that was
// the app's single largest source of Supabase egress.
//
// Handing back the SAME url for most of its life fixes that: the second visit
// downloads nothing. Anything that changes the object behind a path must call
// invalidate(), so a replaced image is never served from a stale URL.

import { supabaseAdmin } from '../supabase.js'

export interface SignedUrlCache {
  /** A signed URL for `path`, or null when the object isn't there. */
  sign(path: string): Promise<string | null>
  /** Sign a list in one round trip; missing objects simply aren't in the map. */
  signMany(paths: string[]): Promise<Map<string, string>>
  /** Forget a path — call after replacing or deleting the object behind it. */
  invalidate(path: string): void
}

/** How much of a URL's life we're willing to hand out. The remainder is slack,
 *  so a URL handed to a reader always has time left on it. */
const HIT_FRACTION = 0.8
/** A missing object is remembered only briefly: the CA pipeline drops the day's
 *  image around 06:00 IST and it shouldn't stay invisible for an hour after. */
const MISS_MS = 5 * 60_000
/** Bounded so a long-lived process can't grow without limit. */
const MAX_ENTRIES = 2000

export function createSignedUrlCache(bucket: string, ttlSeconds: number): SignedUrlCache {
  const hitMs = Math.floor(ttlSeconds * 1000 * HIT_FRACTION)
  const cache = new Map<string, { url: string | null; until: number }>()

  /** A URL, `null` for a known-missing object, or `undefined` when unknown. */
  const peek = (path: string): string | null | undefined => {
    const hit = cache.get(path)
    if (!hit) return undefined
    if (hit.until <= Date.now()) {
      cache.delete(path)
      return undefined
    }
    return hit.url
  }

  const put = (path: string, url: string | null): void => {
    // Oldest-inserted goes first (Map preserves insertion order).
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(path, { url, until: Date.now() + (url ? hitMs : MISS_MS) })
  }

  return {
    invalidate: (path) => void cache.delete(path),

    async sign(path) {
      const memo = peek(path)
      if (memo !== undefined) return memo
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, ttlSeconds)
      const url = error || !data?.signedUrl ? null : data.signedUrl
      put(path, url)
      return url
    },

    async signMany(paths) {
      const out = new Map<string, string>()
      if (paths.length === 0) return out

      const unknown: string[] = []
      for (const path of paths) {
        const memo = peek(path)
        if (memo === undefined) unknown.push(path)
        else if (memo) out.set(path, memo)
      }
      if (unknown.length === 0) return out

      const { data: signed } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrls(unknown, ttlSeconds)
      const got = new Set<string>()
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) {
          out.set(s.path, s.signedUrl)
          put(s.path, s.signedUrl)
          got.add(s.path)
        }
      }
      // Asked for and not returned = not there. Remember that too, so a wall of
      // image-less rows doesn't re-ask Storage on every page load.
      for (const path of unknown) if (!got.has(path)) put(path, null)
      return out
    },
  }
}
