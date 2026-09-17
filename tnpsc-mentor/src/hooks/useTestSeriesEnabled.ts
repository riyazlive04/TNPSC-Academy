import { useEffect, useState } from 'react'
import { cachedTestSeriesFlags, loadTestSeriesFlags } from '../lib/testSeriesFlags'

/**
 * Whether the superadmin has turned the scheduled Test Series on. Gates both the
 * Test Series nav tab and the Test Arena tile so neither appears until the
 * feature is enabled. Cached for the session (one fetch), shared across the
 * desktop/mobile nav and the Test Arena. Returns false until the check resolves.
 *
 * Loaded together with useRankBoosterEnabled — see lib/testSeriesFlags.ts for
 * why the two must never resolve separately.
 */
export function useTestSeriesEnabled(): boolean {
  const [on, setOn] = useState<boolean>(cachedTestSeriesFlags()?.marathon ?? false)

  useEffect(() => {
    let cancelled = false
    void loadTestSeriesFlags().then((f) => !cancelled && setOn(f?.marathon ?? false))
    return () => {
      cancelled = true
    }
  }, [])

  return on
}
