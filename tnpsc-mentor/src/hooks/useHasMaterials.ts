import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * Whether any material (placement='materials') has been published. Used to hide
 * the Materials nav tab until a superadmin adds content — so users never see an
 * empty Materials section. Cached for the session (one fetch), shared across the
 * desktop and mobile nav. Returns false until the check resolves.
 */
let cache: boolean | null = null
let inflight: Promise<boolean> | null = null

export function useHasMaterials(): boolean {
  const [has, setHas] = useState<boolean>(cache ?? false)

  useEffect(() => {
    if (cache !== null) {
      setHas(cache)
      return
    }
    let cancelled = false
    inflight =
      inflight ??
      api.materials
        .list('materials')
        .then((m) => {
          cache = m.length > 0
          return cache
        })
        .catch(() => {
          // Don't poison the shared cache on a transient failure - that would
          // hide this feature for the rest of the session with no way to
          // recover. Clear `inflight` so the next mount retries instead.
          inflight = null
          return false
        })
    inflight.then((v) => !cancelled && setHas(v))
    return () => {
      cancelled = true
    }
  }, [])

  return has
}
