import { useEffect, useState } from 'react'
import { Newspaper, ChevronRight, Download } from 'lucide-react'
import { api, type Material } from '../../lib/api'
import { issueDateLabel, magazineName } from '../../lib/caMagazine'
import MagazineReader from '../Materials/MagazineReader'
import SectionHeader from '../UI/SectionHeader'
import { useT } from '../../lib/i18n'

/**
 * Dashboard carousel of the most recent daily Current-Affairs magazine issues —
 * the last 7 that the superadmin has published (an active kind='magazine',
 * day_wise materials row). Purely publication-driven: nothing appears until an
 * issue is approved, and hiding it in the console removes it here.
 *
 * Reuses the materials list (no dedicated endpoint) and the full MagazineReader
 * (read + language toggle + watermarked PDF download). Renders nothing when
 * there are no published daily issues, so it never leaves an empty shell.
 */

// Module-level cache so navigating away and back doesn't refetch/flash.
let cache: Material[] | null = null

export default function CaMagazineCarousel() {
  const { t, lang } = useT()
  const [issues, setIssues] = useState<Material[] | null>(cache)
  const [active, setActive] = useState<Material | null>(null)

  useEffect(() => {
    let cancelled = false
    api.materials
      .list('materials')
      .then((all) => {
        const daily = all
          .filter((m) => m.kind === 'magazine' && m.magazine_ca_type === 'day_wise' && m.magazine_date)
          .sort((a, b) => (a.magazine_date! < b.magazine_date! ? 1 : -1))
          .slice(0, 7)
        cache = daily
        if (!cancelled) setIssues(daily)
      })
      .catch(() => {
        // Decorative dashboard strip — stay silent on failure (the Materials tab
        // is the reliable path) rather than surfacing an error on the home page.
        if (!cancelled) setIssues([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!issues || issues.length === 0) return null

  return (
    <section className="space-y-3">
      <SectionHeader title={t('caCarouselTitle')} className="px-1" />
      {/* Edge-to-edge horizontal scroller with snap; cards sized for ~2.3 per
          viewport on a phone so the row visibly invites a swipe. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {issues.map((m) => (
          <button
            key={m.id}
            onClick={() => setActive(m)}
            className="focus-ring group flex w-40 flex-shrink-0 snap-start flex-col rounded-card border border-line bg-card p-3.5 text-left transition-colors hover:border-brand/40"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
              <Newspaper size={18} />
            </span>
            <span className="tamil mt-3 font-heading text-sm font-semibold leading-snug text-ink">
              {magazineName(lang)}
            </span>
            <span className="tamil mt-0.5 font-body text-xs text-ink2">
              {issueDateLabel('day_wise', m.magazine_date!, lang)}
            </span>
            <span className="mt-3 inline-flex items-center gap-1 font-heading text-[11px] font-semibold text-brand">
              {m.downloadable ? <Download size={12} /> : <ChevronRight size={13} />}
              {t('materialOpen')}
            </span>
          </button>
        ))}
      </div>

      {active && active.magazine_ca_type && active.magazine_date && (
        <MagazineReader
          caType={active.magazine_ca_type}
          date={active.magazine_date}
          load={() => api.caMagazine.items(active.id)}
          onClose={() => setActive(null)}
          downloadable={active.downloadable}
        />
      )}
    </section>
  )
}
