// ─── Server-driven UI: a slot ────────────────────────────────────────────────
// Drop one of these at any point in a hand-written screen and that point
// becomes editable from the console. With nothing published it renders its
// `fallback` — which is the JSX that used to sit there — so adding a slot is a
// no-op until someone actually publishes to it.
//
//   <SduiSlot name="home.banners" fallback={<DiscoveryBanners />} />
//
// That is the migration path for the rest of the app: wrap a region, publish a
// layout that reproduces it, then delete the hand-written copy once the
// server-driven one has been live for a release. Nothing has to be converted in
// one go, and every step is individually revertible by pausing a row.

import type { ReactNode } from 'react'
import { useSduiLayout } from '../../lib/sdui/client'
import { useSduiContext, type SduiSignals } from '../../lib/sdui/context'
import SduiRenderer from './SduiRenderer'

export default function SduiSlot({
  name,
  fallback = null,
  signals,
  className,
}: {
  /** Slot key, e.g. 'home.banners'. Matches the row's key in the console. */
  name: string
  /** The built-in UI for this region. Shown until a layout is published, and
   *  again if a published one fails to render. */
  fallback?: ReactNode
  /** Progress facts the host page already has loaded — see SduiSignals. */
  signals?: SduiSignals
  className?: string
}) {
  const { layout, ready } = useSduiLayout(name)
  const ctx = useSduiContext(signals)

  // Before the first load settles, show the built-in. A slot that rendered
  // nothing while waiting would make the screen jump as layouts arrive.
  if (!ready || !layout) return <>{fallback}</>

  return (
    <div className={className}>
      <SduiRenderer layout={layout} ctx={ctx} fallback={fallback} />
    </div>
  )
}
