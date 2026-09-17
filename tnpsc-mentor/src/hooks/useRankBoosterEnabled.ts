import { useEffect, useState } from 'react'
import { cachedTestSeriesFlags, loadTestSeriesFlags } from '../lib/testSeriesFlags'

/**
 * Whether the superadmin has turned the Group II/IIA Rank Booster series on.
 * Gates both its nav tab and the Test Arena tile so neither appears until the
 * feature is enabled. Cached for the session (one fetch), shared across the
 * desktop/mobile nav and the Test Arena. Returns false until the check resolves.
 *
 * Loaded together with useTestSeriesEnabled — see lib/testSeriesFlags.ts for
 * why the two must never resolve separately.
 */
export function useRankBoosterEnabled(): boolean {
  const [on, setOn] = useState<boolean>(cachedTestSeriesFlags()?.rankBooster ?? false)

  useEffect(() => {
    let cancelled = false
    void loadTestSeriesFlags().then((f) => !cancelled && setOn(f?.rankBooster ?? false))
    return () => {
      cancelled = true
    }
  }, [])

  return on
}
