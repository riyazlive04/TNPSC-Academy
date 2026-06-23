// ─── Thirukural data layer ──────────────────────────────────────────────────
// The 1330 kurals live in the `public.thirukural` table and are served by the
// API (GET /api/thirukural) - read-only reference content with no per-user
// state. We fetch the full set once and cache it at module scope, so navigating
// between the list and a detail view never re-fetches.

import { api } from './api'
import type { Kural } from '../types'

export type { Kural }

/** A chapter (adhigaram) with its kurals, used for the grouped list view. */
export interface Adhigaram {
  no: number
  ta: string
  en: string
  translit: string
  paal_en: string
  iyal_en: string
  kurals: Kural[]
}

let cache: Kural[] | null = null
let inflight: Promise<Kural[]> | null = null

/** Fetch + cache the full kural list. Concurrent callers share one request. */
export async function loadKurals(): Promise<Kural[]> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = api
    .thirukural()
    .then((data) => {
      cache = data
      inflight = null
      return data
    })
    .catch((err) => {
      inflight = null
      throw err
    })
  return inflight
}

/** Synchronous lookup of a single kural by number from the cache (if loaded). */
export function getCachedKural(no: number): Kural | undefined {
  return cache?.find((k) => k.kural_no === no)
}

/**
 * The "Kural of the day" - a deterministic pick that's stable for a whole
 * calendar day and advances by one each day, cycling through all 1330. Keyed on
 * the local date (not the clock), so it doesn't change as the day goes on.
 */
export function kuralOfDay(kurals: Kural[], date: Date = new Date()): Kural | undefined {
  if (!kurals.length) return undefined
  const dayNum = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  )
  const idx = ((dayNum % kurals.length) + kurals.length) % kurals.length
  return kurals[idx]
}

/**
 * Split an English couplet translation into its two display lines, so the banner
 * can show it as a couplet (line 1 above line 2) like the Tamil.
 *
 * `translation_en` marks the break between the couplet's two lines in one of two
 * ways: an explicit run of 2+ spaces (~1/3 of kurals), or simply by starting the
 * second line with a capital. We honour the explicit marker when present;
 * otherwise we fall back to the word boundary nearest the midpoint, preferring a
 * capitalised second-line start. Validated against the explicit-marker rows at
 * ~99%. Returns a single element when the text is too short to split.
 */
export function splitCoupletEn(text: string): [string] | [string, string] {
  const raw = (text ?? '').trim()
  const dbl = raw.match(/\s{2,}/)
  if (dbl && dbl.index !== undefined && dbl.index > 0) {
    return [raw.slice(0, dbl.index).trim(), raw.slice(dbl.index + dbl[0].length).trim()]
  }
  const words = raw.split(/\s+/)
  if (words.length < 2) return [raw]
  const mid = raw.length / 2
  let capIdx = -1, capDist = Infinity, anyIdx = 1, anyDist = Infinity, pos = 0
  for (let i = 0; i < words.length - 1; i++) {
    pos += words[i].length + 1
    const d = Math.abs(pos - mid)
    if (d < anyDist) { anyDist = d; anyIdx = i + 1 }
    if (/^['"(]?[A-Z]/.test(words[i + 1]) && d < capDist) { capDist = d; capIdx = i + 1 }
  }
  const idx = capIdx > 0 ? capIdx : anyIdx
  return [words.slice(0, idx).join(' '), words.slice(idx).join(' ')]
}

/** Group a (possibly filtered) kural list into chapters, preserving order. */
export function groupByAdhigaram(kurals: Kural[]): Adhigaram[] {
  const byNo = new Map<number, Adhigaram>()
  for (const k of kurals) {
    let g = byNo.get(k.adhigaram_no)
    if (!g) {
      g = {
        no: k.adhigaram_no,
        ta: k.adhigaram_ta,
        en: k.adhigaram_en,
        translit: k.adhigaram_translit,
        paal_en: k.paal_en,
        iyal_en: k.iyal_en,
        kurals: [],
      }
      byNo.set(k.adhigaram_no, g)
    }
    g.kurals.push(k)
  }
  return [...byNo.values()]
}

/** The three sections (paal) of the Kural, in canonical order. */
export const PAALS: { no: number; en: string; ta: string }[] = [
  { no: 1, en: 'Virtue', ta: 'அறத்துப்பால்' },
  { no: 2, en: 'Wealth', ta: 'பொருட்பால்' },
  { no: 3, en: 'Love', ta: 'காமத்துப்பால்' },
]

/** Case-insensitive match across the fields a user is likely to search by. */
export function matchesQuery(k: Kural, q: string): boolean {
  if (!q) return true
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  // A bare number matches the kural number exactly-ish (prefix).
  if (/^\d+$/.test(needle) && String(k.kural_no).startsWith(needle)) return true
  return (
    k.line1_ta.toLowerCase().includes(needle) ||
    k.line2_ta.toLowerCase().includes(needle) ||
    k.adhigaram_ta.toLowerCase().includes(needle) ||
    k.adhigaram_en.toLowerCase().includes(needle) ||
    k.adhigaram_translit.toLowerCase().includes(needle) ||
    k.transliteration.toLowerCase().includes(needle) ||
    k.couplet_en.toLowerCase().includes(needle) ||
    k.translation_en.toLowerCase().includes(needle) ||
    k.explanation_en.toLowerCase().includes(needle)
  )
}
