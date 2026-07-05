import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * Whether the superadmin has turned Vettri Nichayam on. Gates both the Vettri nav
 * tab and the Test Arena tile so neither appears until the feature is enabled.
 * Cached for the session (one fetch), shared across nav + Test Arena. Returns
 * false until the check resolves. Mirrors useTestSeriesEnabled.
 */
let cache: boolean | null = null
let inflight: Promise<boolean> | null = null

export function useVettriEnabled(): boolean {
  const [on, setOn] = useState<boolean>(cache ?? false)

  useEffect(() => {
    if (cache !== null) {
      setOn(cache)
      return
    }
    let cancelled = false
    inflight =
      inflight ??
      api
        .appSettings()
        .then((s) => {
          cache = Boolean(s.vettri_enabled)
          return cache
        })
        .catch(() => {
          cache = false
          return false
        })
    inflight.then((v) => !cancelled && setOn(v))
    return () => {
      cancelled = true
    }
  }, [])

  return on
}
