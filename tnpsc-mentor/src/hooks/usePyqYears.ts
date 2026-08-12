import { useEffect, useState } from 'react'
import { api } from '../lib/api'

// Years change only when a paper is imported, so one fetch per (category,
// section) lasts the session. Keyed by both so Group 2 doesn't show Group 4's
// years, and so a section's narrowed list doesn't leak to the group page.
const cache = new Map<string, number[]>()
const cacheKey = (category: string, subject?: string) => `${category}|${subject ?? ''}`

/**
 * The exam years a bank actually holds, newest first — the source for the PYQ
 * year chips. Returns null while loading so the caller can tell "not known yet"
 * from "genuinely none", which matters because the `?year=` param is validated
 * against this list.
 *
 * Fetched rather than hardcoded so importing a new year's paper puts its chip in
 * the UI with no code change (see supabase/pyq_years.sql). Pass `subject` to get
 * only the years that one section has.
 */
export function usePyqYears(category?: string, subject?: string): number[] | null {
  const key = category ? cacheKey(category, subject) : ''
  const [years, setYears] = useState<number[] | null>(() => (key ? cache.get(key) ?? null : []))

  useEffect(() => {
    if (!category) return
    const cached = cache.get(key)
    if (cached) {
      setYears(cached)
      return
    }
    setYears(null)
    let cancelled = false
    api
      .questionYears({ category, subject })
      .then((rows) => {
        if (cancelled) return
        const list = rows.map((r) => r.year)
        cache.set(key, list)
        setYears(list)
      })
      // An empty list hides the chip row rather than stranding the page on a
      // spinner; "All Years" still works, so the section stays usable.
      .catch(() => {
        if (!cancelled) setYears([])
      })
    return () => {
      cancelled = true
    }
  }, [category, subject, key])

  return years
}
