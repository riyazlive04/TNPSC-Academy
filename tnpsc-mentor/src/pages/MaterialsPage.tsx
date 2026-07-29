import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Play, FileText, Image as ImageIcon, Download, Library, Newspaper, ListChecks } from 'lucide-react'
import MaterialViewer from '../components/Materials/MaterialViewer'
import MagazineReader from '../components/Materials/MagazineReader'
import { SkeletonCards } from '../components/UI/Skeleton'
import { api, type Material, type MaterialKind } from '../lib/api'
import { youtubeThumb, materialTitle, kindLabel, formatFileSize } from '../lib/materials'
import { issueDateLabel, magazineName } from '../lib/caMagazine'
import { useT, type StringKey } from '../lib/i18n'

const KIND_ICON: Record<MaterialKind, typeof Play> = {
  video: Play,
  image: ImageIcon,
  pdf: FileText,
  document: FileText,
  magazine: Newspaper,
  questions: ListChecks,
}

// Type filter chips (the value 'all' shows everything). CA Questions have their
// own dashboard section (/test-arena/ca-questions), so they're excluded here.
const FILTERS: { value: MaterialKind | 'all'; key: StringKey }[] = [
  { value: 'all', key: 'materialsAllTypes' },
  { value: 'magazine', key: 'typeMagazine' },
  { value: 'video', key: 'typeVideo' },
  { value: 'image', key: 'typeImage' },
  { value: 'pdf', key: 'typePdf' },
  { value: 'document', key: 'typeDocument' },
]

export default function MaterialsPage() {
  const { t, lang } = useT()
  const [items, setItems] = useState<Material[] | null>(null)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<MaterialKind | 'all'>('all')
  const [active, setActive] = useState<Material | null>(null)

  const load = () => {
    setError(false)
    api.materials
      // CA Questions are surfaced in their own dashboard section, not here.
      .list('materials')
      .then((all) => setItems(all.filter((m) => m.kind !== 'questions')))
      .catch(() => setError(true))
  }
  useEffect(load, [])

  const openMaterial = (m: Material) => setActive(m)

  // Only show filter chips for kinds that actually exist in the bank.
  const present = useMemo(() => new Set((items ?? []).map((m) => m.kind)), [items])
  const filters = FILTERS.filter((f) => f.value === 'all' || present.has(f.value))
  const filtered = (items ?? []).filter((m) => filter === 'all' || m.kind === filter)

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <Library size={22} />
          </span>
          <div>
            <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">
              {t('materialsTitle')}
            </h1>
            <p className="tamil font-body text-[14px] text-muted">{t('materialsSubtitle')}</p>
          </div>
        </div>

        {/* Type filter */}
        {items && items.length > 0 && filters.length > 2 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`tamil rounded-full border px-3.5 py-1.5 font-heading text-xs font-semibold transition ${
                  filter === f.value
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-card text-ink2 hover:border-brand-ring hover:text-ink'
                }`}
              >
                {t(f.key)}
              </button>
            ))}
          </div>
        )}

        {items === null && !error && (
          // Same responsive card grid the materials land in.
          <SkeletonCards
            count={8}
            height="h-40"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          />
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle size={30} className="text-coral" />
            <p className="font-body text-ink2">{t('couldNotLoad')}</p>
            <button onClick={load} className="btn-ghost btn-sm">
              {t('retry')}
            </button>
          </div>
        )}

        {items && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Library size={30} className="text-ink2/50" />
            <p className="tamil max-w-sm font-body text-ink2">{t('materialsEmpty')}</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((m, i) => (
              <MaterialCard key={m.id} m={m} lang={lang} i={i} onOpen={() => openMaterial(m)} />
            ))}
          </div>
        )}
      </div>

      {active && active.kind !== 'magazine' && active.kind !== 'questions' && (
        <MaterialViewer material={active} onClose={() => setActive(null)} />
      )}
      {active && active.kind === 'magazine' && active.magazine_ca_type && active.magazine_date && (
        <MagazineReader
          caType={active.magazine_ca_type}
          date={active.magazine_date}
          load={() => api.caMagazine.items(active.id)}
          loadNewsImage={() => api.caMagazine.newsImage(active.id)}
          onClose={() => setActive(null)}
          downloadable={active.downloadable}
        />
      )}
    </>
  )
}

function MaterialCard({
  m,
  lang,
  i,
  onOpen,
}: {
  m: Material
  lang: 'en' | 'ta' | 'both'
  i: number
  onOpen: () => void
}) {
  const { t } = useT()
  const Icon = KIND_ICON[m.kind]
  // Magazine cards are named and dated from the issue itself (name on one line,
  // date on the next) rather than from whatever title the row was published with.
  const issue = m.kind === 'magazine' && m.magazine_ca_type && m.magazine_date
  const title = issue ? magazineName(lang) : materialTitle(m, lang)
  const dateLine = issue ? issueDateLabel(m.magazine_ca_type!, m.magazine_date!, lang) : null
  return (
    <button
      onClick={onOpen}
      style={{ '--i': i } as React.CSSProperties}
      className="card stagger-item interactive group flex flex-col overflow-hidden p-0 text-left disabled:opacity-70"
    >
      {/* Media / thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-tint">
        {m.kind === 'video' && m.youtube_id ? (
          <img
            src={youtubeThumb(m.youtube_id)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-tint-violet text-primary">
            <Icon size={30} />
          </div>
        )}
        {/* Play overlay for videos */}
        {m.kind === 'video' && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition group-hover:bg-brand">
              <Play size={20} fill="currentColor" />
            </span>
          </span>
        )}
        {/* Download-available badge */}
        {m.downloadable && (
          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-mint/90 text-white" title={t('materialDownload')}>
            <Download size={12} />
          </span>
        )}
      </div>
      {/* Meta */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-primary">
          {kindLabel(m.kind)}
          {m.file_size ? ` · ${formatFileSize(m.file_size)}` : ''}
        </span>
        <span className="tamil line-clamp-2 font-heading text-sm font-semibold leading-snug text-ink">
          {title}
        </span>
        {dateLine && <span className="tamil font-body text-xs text-ink2">{dateLine}</span>}
      </div>
    </button>
  )
}
