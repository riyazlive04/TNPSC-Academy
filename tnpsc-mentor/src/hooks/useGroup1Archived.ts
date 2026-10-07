import { useEffect, useState } from 'react'
import { cachedTestSeriesFlags, loadTestSeriesFlags } from '../lib/testSeriesFlags'

/**
 * Whether Group 1 has been retired (settings.group1_archived) — the 2026 prelims
 * was sat on 27 Sep 2026, so the series is a finished exam rather than an
 * upcoming one.
 *
 * True means: grey the Group 1 papers out and label them as completed, drop
 * every Group 1 pitch (price badges, promo banners, the "test 1 is free" nudge),
 * and stop offering the plans. It does NOT mean hide anything: the tab, the Test
 * Arena tile and the papers themselves stay exactly where a paying customer left
 * them, and the server keeps serving them. Use `useTestSeriesEnabled` for the
 * separate question of whether the product area exists at all.
 *
 * Reads from the same one-request flag loader as the other product switches, so
 * it can never resolve in a different render from `marathon` — a frame in which
 * "Group 1 is on but not archived" was briefly true is a frame that pitches a
 * dead exam.
 *
 * False until the flags load. That errs towards showing the live treatment for a
 * moment rather than greying out a series that is actually running, which is the
 * cheaper mistake: the pitch surfaces are separately gated on `usePlanSales`,
 * which errs the other way and shows no price until it knows.
 */
export function useGroup1Archived(): boolean {
  const [archived, setArchived] = useState<boolean>(
    cachedTestSeriesFlags()?.group1Archived ?? false
  )

  useEffect(() => {
    let cancelled = false
    void loadTestSeriesFlags().then((f) => !cancelled && setArchived(f?.group1Archived ?? false))
    return () => {
      cancelled = true
    }
  }, [])

  return archived
}
