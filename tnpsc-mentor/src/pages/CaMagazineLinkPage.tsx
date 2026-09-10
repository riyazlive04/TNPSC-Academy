import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Newspaper } from 'lucide-react'
import { api, type Material } from '../lib/api'
import { issueDateLabel, magazineName } from '../lib/caMagazine'
import { caMagazineLink, isIsoDate } from '../lib/shareLinks'
import MagazineReader from '../components/Materials/MagazineReader'
import ShareLinkButton from '../components/UI/ShareLinkButton'
import SectionHeader from '../components/UI/SectionHeader'
import ErrorState from '../components/UI/ErrorState'
import { SkeletonCards } from '../components/UI/Skeleton'
import { useT } from '../lib/i18n'

/**
 * The Current-Affairs magazine as a whole, at /ca/magazine — every published
 * issue, newest first — and the resolver behind /ca/magazine/:date, which
 * opens ONE issue over that same archive.
 *
 * One component for both because the reader is a fixed overlay: landing
 * straight on a shared issue still leaves the whole run underneath it, so
 * closing the issue lands on the archive rather than dead-ending, and opening
 * a card just moves the URL to /ca/magazine/:date — the address bar always
 * matches what is on screen, which is what makes any of it shareable.
 *
 * Reads the MATERIALS list, not /ca-magazine/recent: recent is capped at 14
 * rows server-side (it exists for the dashboard strip), which would have made
 * an "archive" that quietly stopped a fortnight back. The materials list is
 * the same one the Materials tab renders, so the archive holds exactly what
 * that tab holds, and a link to any issue ever published resolves.
 */
export default function CaMagazineLinkPage() {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const { date } = useParams<{ date?: string }>()
  const [items, setItems] = useState<Material[] | null>(null)
  const [covers, setCovers] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)

  const load = () => {
    setError(null)
    api.materials
      .list('materials')
      .then((all) => {
        setItems(
          all
            .filter((m) => m.kind === 'magazine' && m.magazine_date && m.magazine_ca_type)
            .sort((a, b) => (b.magazine_date ?? '').localeCompare(a.magazine_date ?? ''))
        )
        // Covers are a separate batch call (the same one the Materials tab
        // makes). Non-critical — a failure just leaves the icon fallback.
        api.caMagazine
          .thumbnails()
          .then(setCovers)
          .catch(() => undefined)
      })
      .catch(setError)
  }
  useEffect(load, [])

  const daily = useMemo(
    () => (items ?? []).filter((m) => m.magazine_ca_type === 'day_wise'),
    [items]
  )
  const monthly = useMemo(
    () => (items ?? []).filter((m) => m.magazine_ca_type !== 'day_wise'),
    [items]
  )

  // A malformed date can't match anything, so it falls through to "not found"
  // rather than being looked up.
  const wanted = isIsoDate(date) ? date : undefined
  // Day-wise wins a date collision: a monthly issue is dated to some day of its
  // month, which could coincide with a daily issue, and /ca/magazine/:date is
  // handed out for daily papers (see the share button in MagazineReader).
  const active =
    wanted && items
      ? daily.find((m) => m.magazine_date === wanted) ??
        monthly.find((m) => m.magazine_date === wanted) ??
        null
      : null
  const notFound = !!date && !!items && !active

  const card = (m: Material) => (
    <button
      key={m.id}
      onClick={() => navigate(`/ca/magazine/${m.magazine_date}`)}
      className="focus-ring group overflow-hidden rounded-card border border-line bg-card text-left transition-colors hover:border-brand/40"
    >
      <span className="block aspect-[3/2] w-full overflow-hidden bg-tint-violet">
        {covers[m.id] ? (
          <img
            src={covers[m.id]}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-brand">
            <Newspaper size={26} />
          </span>
        )}
      </span>
      <span className="block p-3">
        <span className="tamil block truncate font-heading text-sm font-semibold leading-snug text-ink">
          {magazineName(lang)}
        </span>
        <span className="tamil mt-0.5 block truncate font-body text-xs text-ink2">
          {issueDateLabel(m.magazine_ca_type ?? 'day_wise', m.magazine_date ?? '', lang)}
        </span>
      </span>
    </button>
  )

  const grid = (list: Material[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{list.map(card)}</div>
  )

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <Newspaper size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="tamil font-display text-2xl font-bold tracking-tight text-ink">
              {magazineName(lang)}
            </h1>
            <p className="tamil font-body text-sm text-muted">{t('caArchiveSub')}</p>
          </div>
          {/* The dateless link — the magazine as a whole, rather than one day. */}
          <ShareLinkButton
            url={caMagazineLink()}
            title={magazineName(lang)}
            text={t('shareCaMagazineAllText')}
            label={t('shareCaMagazineAll')}
          />
        </div>

        {notFound && (
          <p className="tamil mb-5 rounded-field border border-accentwarm/30 bg-accentwarmsoft px-3.5 py-2.5 font-body text-sm leading-snug text-ink">
            {t('caLinkMagazineMissing')}
          </p>
        )}

        {error != null && <ErrorState error={error} onRetry={load} />}

        {items === null && !error && (
          <SkeletonCards
            count={8}
            height="h-40"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          />
        )}

        {items && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Newspaper size={30} className="text-ink2/50" />
            <p className="tamil max-w-sm font-body text-ink2">{t('caArchiveEmpty')}</p>
          </div>
        )}

        {items && !error && items.length > 0 && (
          <div className="space-y-8">
            {daily.length > 0 && (
              <section className="space-y-3">
                {monthly.length > 0 && <SectionHeader title={t('caArchiveDaily')} className="px-1" />}
                {grid(daily)}
              </section>
            )}
            {monthly.length > 0 && (
              <section className="space-y-3">
                <SectionHeader title={t('caArchiveMonthly')} className="px-1" />
                {grid(monthly)}
              </section>
            )}
          </div>
        )}
      </div>

      {active && (
        <MagazineReader
          caType={active.magazine_ca_type ?? 'day_wise'}
          date={active.magazine_date ?? ''}
          load={() => api.caMagazine.items(active.id)}
          loadNewsImage={() => api.caMagazine.newsImage(active.id)}
          onClose={() => navigate('/ca/magazine')}
          downloadable={active.downloadable}
        />
      )}
    </>
  )
}
