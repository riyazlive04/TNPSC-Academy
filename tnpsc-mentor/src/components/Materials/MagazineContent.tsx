import type { CaMagazineItem } from '../../lib/api'
import { groupBySection, parseBullets, sectionLabel } from '../../lib/caMagazine'
import { useT } from '../../lib/i18n'

/**
 * The read-only rendering of a magazine issue: items grouped into the canonical
 * sections (TNPSC Bits first), content as markdown bullets with `**bold**`.
 * Shared by the student reader (MagazineReader) and the admin editor's preview
 * (MagazineEditor) so both render identically. Language follows the arg.
 */
export default function MagazineSections({
  items,
  lang,
}: {
  items: CaMagazineItem[]
  lang: 'en' | 'ta' | 'both'
}) {
  const sections = groupBySection(items)
  return (
    <>
      {sections.map(({ topic, items: sectionItems }) => (
        <section key={topic}>
          <h3 className="tamil sticky top-0 z-10 border-b border-line bg-canvas/95 px-4 py-2.5 font-heading text-xs font-bold uppercase tracking-wider text-brand backdrop-blur-sm sm:px-6">
            {sectionLabel(topic, lang)}
          </h3>
          <div className="space-y-3 px-4 py-4 sm:px-6">
            {sectionItems.map((item) => (
              <MagazineItemView key={item.id} item={item} topic={topic} lang={lang} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function MagazineItemView({
  item,
  topic,
  lang,
}: {
  item: CaMagazineItem
  topic: string
  lang: 'en' | 'ta' | 'both'
}) {
  const ta = item.title_ta?.trim()
  // TNPSC BITS arrives as one row titled like its section — skip the echo.
  const showTitle = item.title.trim().toUpperCase() !== topic.toUpperCase()
  const showEn = lang !== 'ta' || !item.content_ta
  const showTa = (lang === 'ta' || lang === 'both') && !!item.content_ta

  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      {showTitle && (
        <header className="mb-2">
          {(lang === 'en' || lang === 'both' || !ta) && (
            <h4 className="font-heading text-sm font-semibold leading-snug text-ink">{item.title}</h4>
          )}
          {(lang === 'ta' || lang === 'both') && ta && (
            <h4 className="tamil font-heading text-sm font-semibold leading-snug text-ink">{ta}</h4>
          )}
        </header>
      )}
      {showEn && <Bullets md={item.content} />}
      {showEn && showTa && <div className="my-2.5 border-t border-dashed border-line" />}
      {showTa && <Bullets md={item.content_ta as string} tamil />}
    </article>
  )
}

/** Markdown bullet block: `- ` lines with 2-space nesting and `**bold**`. */
function Bullets({ md, tamil = false }: { md: string; tamil?: boolean }) {
  const lines = parseBullets(md)
  return (
    <div className={`space-y-1.5 font-body text-[13.5px] leading-relaxed text-ink2 ${tamil ? 'tamil' : ''}`}>
      {lines.map((line, i) => (
        <div key={i} className="flex gap-2" style={{ paddingLeft: `${line.depth * 16}px` }}>
          <span
            className={`mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full ${
              line.depth === 0 ? 'bg-brand/70' : 'bg-ink2/40'
            }`}
          />
          <p className="min-w-0 flex-1">
            <Rich text={line.text} />
          </p>
        </div>
      ))}
    </div>
  )
}

/** Inline `**bold**` spans → <strong>. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </>
  )
}

/** Empty-state line for a magazine with no items (used by the editor). */
export function MagazineEmpty() {
  const { t } = useT()
  return <p className="px-6 py-16 text-center font-body text-sm text-ink2">{t('caMagazineNoItems')}</p>
}
