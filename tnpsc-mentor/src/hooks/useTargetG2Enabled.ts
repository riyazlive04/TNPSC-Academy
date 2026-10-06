import { useEffect, useState } from 'react'
import { cachedTestSeriesFlags, loadTestSeriesFlags } from '../lib/testSeriesFlags'

/**
 * Whether the superadmin has turned the Target Group 2 2026 language series on.
 * Gates its /test-series hub tab and its Test Arena tile, so neither appears
 * until the product is enabled. ONE flag covers both the English and the Tamil
 * track — they are one product sold through two pay links, and there is no
 * state in which only one of them should exist.
 *
 * Loaded together with useTestSeriesEnabled / useRankBoosterEnabled — see
 * lib/testSeriesFlags.ts for why the hub's product flags must never resolve
 * separately. Returns false until the check resolves.
 */
export function useTargetG2Enabled(): boolean {
  const [on, setOn] = useState<boolean>(cachedTestSeriesFlags()?.targetG2 ?? false)

  useEffect(() => {
    let cancelled = false
    void loadTestSeriesFlags().then((f) => !cancelled && setOn(f?.targetG2 ?? false))
    return () => {
      cancelled = true
    }
  }, [])

  return on
}
