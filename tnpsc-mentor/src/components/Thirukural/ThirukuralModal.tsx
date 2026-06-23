import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Search, X } from 'lucide-react'
import { List, ListRow } from '../UI/ListRow'
import { useFocusTrap } from '../UI/useFocusTrap'
import {
  loadKurals,
  groupByAdhigaram,
  matchesQuery,
  PAALS,
  type Kural,
} from '../../lib/thirukural'
import { useT } from '../../lib/i18n'

/**
 * The Thirukkural popup. Opened from the dashboard "Thirukkural" link. A single
 * box that holds BOTH views: a searchable, paal-filtered, chapter-grouped list,
 * and - once a kural is tapped - its full detail (couplet, transliteration,
 * translations, classical Tamil commentaries) with prev/next. Back returns to
 * the list; Escape backs out one level then closes. All content follows the
 * chosen language (Tamil / English / bilingual).
 */
export default function ThirukuralModal({
  open,
  onClose,
  initialKuralNo,
}: {
  open: boolean
  onClose: () => void
  /** When set, the box opens straight to this kural's detail (e.g. kural of the
   * day). Back still returns to the list. */
  initialKuralNo?: number
}) {
  const { t, lang } = useT()
  const [kurals, setKurals] = useState<Kural[] | null>(null)
  const [error, setError] = useState(false)
  const [paal, setPaal] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Trap Tab focus within the dialog and restore it to the opener on close.
  useFocusTrap(open, dialogRef)

  const showTa = lang !== 'en'

  // Each time the box opens, start at the requested kural (or the list).
  useEffect(() => {
    if (open) setSelected(initialKuralNo ?? null)
  }, [open, initialKuralNo])

  // Lazy-load the data the first time the modal is opened.
  useEffect(() => {
    if (!open || kurals) return
    let cancelled = false
    loadKurals()
      .then((data) => !cancelled && setKurals(data))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [open, kurals])

  // Escape backs out one level (detail → list → closed); lock body scroll.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selected !== null) setSelected(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, selected, onClose])

  const groups = useMemo(() => {
    if (!kurals) return []
    const filtered = kurals.filter(
      (k) => (paal === 'all' || k.paal_no === paal) && matchesQuery(k, query)
    )
    return groupByAdhigaram(filtered)
  }, [kurals, paal, query])

  const current = selected !== null ? kurals?.find((k) => k.kural_no === selected) : undefined

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm animate-fadeInFast sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('thirukuralTitle')}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-card outline-none animate-sheetIn sm:h-[85vh] sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-6">
          {current ? (
            <button
              onClick={() => setSelected(null)}
              className="focus-ring -ml-1 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-tint-violet hover:text-primary"
              aria-label={t('back')}
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}
          {current ? (
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="font-heading text-[12px] font-bold uppercase tracking-[0.12em] text-accent">
                Kural No
              </span>
              <span className="font-display text-2xl font-bold leading-none text-ink">
                {current.kural_no}
              </span>
            </div>
          ) : (
            <h2 className="tamil min-w-0 flex-1 truncate font-display text-[17px] font-bold text-ink">
              {t('thirukuralTitle')}
            </h2>
          )}
          <button
            onClick={onClose}
            className="focus-ring grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-tint-coral hover:text-accent"
            aria-label={t('dismiss')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <p className="py-12 text-center font-body text-sm text-muted">{t('couldNotLoad')}</p>
          ) : kurals === null ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : current ? (
            <KuralDetail k={current} lang={lang} />
          ) : (
            <>
              {/* Paal filter */}
              <div className="mb-3 flex flex-wrap gap-2">
                <Chip active={paal === 'all'} onClick={() => setPaal('all')}>
                  {t('paalAll')}
                </Chip>
                {PAALS.map((p) => (
                  <Chip key={p.no} active={paal === p.no} onClick={() => setPaal(p.no)}>
                    <span className="tamil">{lang === 'en' ? p.en : p.ta}</span>
                  </Chip>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('thirukuralSearch')}
                  className="focus-ring tamil w-full rounded-tile border border-line bg-surface py-2.5 pl-10 pr-4 font-body text-[15px] text-ink placeholder:text-muted/70"
                />
              </div>

              {groups.length === 0 ? (
                <p className="py-12 text-center font-body text-sm text-muted">
                  {t('thirukuralNoResults')}
                </p>
              ) : (
                <div className="space-y-6">
                  {groups.map((g) => (
                    <section key={g.no}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 px-1">
                        <h3 className="tamil min-w-0 truncate font-display text-[14px] font-bold text-ink">
                          {g.no}. {lang === 'en' ? g.en : g.ta}
                        </h3>
                        <span className="tamil flex-shrink-0 font-heading text-[11px] font-semibold uppercase tracking-wide text-accent">
                          {lang === 'both' ? g.en : g.translit}
                        </span>
                      </div>
                      <List>
                        {g.kurals.map((k) => (
                          <ListRow
                            key={k.kural_no}
                            onClick={() => setSelected(k.kural_no)}
                            leading={
                              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-tile bg-tint-violet font-heading text-[13px] font-bold text-primary">
                                {k.kural_no}
                              </span>
                            }
                            title={
                              showTa ? (
                                <span className="tamil">{k.line1_ta} {k.line2_ta}</span>
                              ) : (
                                k.translation_en
                              )
                            }
                            subtitle={lang === 'both' ? k.translation_en : undefined}
                          />
                        ))}
                      </List>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Detail view (inside the modal) ──────────────────────────────────────────
// A data-sheet card that follows the chosen language: Tamil mode shows the Tamil
// verse + Tamil paal/iyal/adhigaram + Kalaignar's (Mu. Karunanidhi) explanation;
// English mode shows the romanised verse + English names + English meaning;
// bilingual shows everything (the full reference card).
function KuralDetail({ k, lang }: { k: Kural; lang: string }) {
  const showTa = lang !== 'en'
  const showEn = lang !== 'ta'
  const ta = lang === 'ta' // pure-Tamil → Tamil labels too

  // The stored transliteration is the two couplet halves joined by "/".
  const translitLines = k.transliteration
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <dl className="divide-y divide-line">
      {/* KURAL - Tamil verse and/or romanised verse */}
      <DetailRow label={ta ? 'குறள்' : 'Kural'} labelTamil={ta}>
        {showTa && (
          <p className="tamil font-display text-[17px] font-bold leading-relaxed text-ink sm:text-[19px]">
            {k.line1_ta}
            <br />
            {k.line2_ta}
          </p>
        )}
        {showEn && (
          <p
            className={`font-display italic leading-relaxed ${
              showTa
                ? 'mt-1.5 text-[13px] font-medium text-muted'
                : 'text-[15px] font-semibold text-ink sm:text-base'
            }`}
          >
            {translitLines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        )}
      </DetailRow>

      <DetailRow label={ta ? 'பால்' : 'Paal'} labelTamil={ta}>
        <BiValue ta={k.paal_ta} en={k.paal_en} lang={lang} />
      </DetailRow>

      <DetailRow label={ta ? 'இயல்' : 'Iyal'} labelTamil={ta}>
        <BiValue ta={k.iyal_ta} en={k.iyal_en} lang={lang} />
      </DetailRow>

      <DetailRow label={ta ? 'அதிகாரம்' : 'Adhigaram'} labelTamil={ta}>
        <BiValue ta={k.adhigaram_ta} en={k.adhigaram_en} lang={lang} />
      </DetailRow>

      {/* பொருள் - Kalaignar's Tamil explanation (ta/both) */}
      {showTa && (
        <DetailRow label="பொருள்" labelTamil>
          <p className="tamil font-body text-[15px] leading-relaxed text-ink">
            {k.urai_mu_karunanidhi}
          </p>
        </DetailRow>
      )}

      {/* Meaning - English (en/both) */}
      {showEn && (
        <DetailRow label="Meaning">
          <p className="font-body text-[15px] leading-relaxed text-muted">{k.explanation_en}</p>
        </DetailRow>
      )}
    </dl>
  )
}

/** A row value that shows Tamil, English, or both (Tamil over muted English). */
function BiValue({ ta, en, lang }: { ta: string; en: string; lang: string }) {
  if (lang === 'en') return <span className="font-body text-[15px] text-ink">{en}</span>
  if (lang === 'ta')
    return <span className="tamil font-body text-[15px] text-ink">{ta}</span>
  return (
    <span>
      <span className="tamil block font-body text-[15px] text-ink">{ta}</span>
      <span className="block font-body text-[13px] text-muted">{en}</span>
    </span>
  )
}

function DetailRow({
  label,
  labelTamil = false,
  children,
}: {
  label: string
  labelTamil?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 py-4 sm:gap-4">
      <dt className="w-[68px] flex-shrink-0 pt-1 sm:w-24">
        <span
          className={`font-heading text-[10px] font-bold uppercase tracking-wide text-muted sm:text-[11px] ${
            labelTamil ? 'tamil' : ''
          }`}
        >
          {label}
        </span>
      </dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring rounded-full px-3.5 py-1.5 font-heading text-sm font-semibold transition-colors ${
        active ? 'bg-primary text-white' : 'bg-tint-violet text-primary hover:opacity-80'
      }`}
    >
      {children}
    </button>
  )
}
