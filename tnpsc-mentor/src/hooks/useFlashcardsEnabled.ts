import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * Whether the superadmin has turned the flashcard ("Instants") decks on for
 * students. Gates the dashboard peek — the only entry point — so the feature
 * stays dark until it is launched.
 *
 * Admins are NOT handled here: the caller ORs this with `isAdmin`, so staff can
 * trial the real thing on production while it reads as absent to everyone else.
 * The API enforces the same rule server-side (routes/flashcards.ts).
 *
 * Cached for the session (one fetch). Returns false until the check resolves.
 */
let cache: boolean | null = null
let inflight: Promise<boolean> | null = null

export function useFlashcardsEnabled(): boolean {
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
          cache = Boolean(s.flashcards_enabled)
          return cache
        })
        .catch(() => {
          // Don't poison the shared cache on a transient failure — clear
          // `inflight` so the next mount retries instead of hiding the feature
          // for the rest of the session.
          inflight = null
          return false
        })
    inflight.then((v) => !cancelled && setOn(v))
    return () => {
      cancelled = true
    }
  }, [])

  return on
}
