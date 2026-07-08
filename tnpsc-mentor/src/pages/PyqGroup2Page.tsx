import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Type, Languages, GraduationCap, type LucideIcon } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile, { type Tint } from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import LogoLoader from '../components/UI/LogoLoader'
import { api } from '../lib/api'
import { PYQ2_SECTIONS, pyq2SectionSlug, subjectName, type Pyq2Section } from '../lib/constants'
import { useT } from '../lib/i18n'

// Section → row presentation (icon + tint). The data behind each is fetched as a
// single count per section (category='pyq2', subject=section).
const SECTION_UI: Record<Pyq2Section, { icon: LucideIcon; tint: Tint }> = {
  Aptitude: { icon: Calculator, tint: 'violet' },
  English: { icon: Type, tint: 'blue' },
  Tamil: { icon: Languages, tint: 'green' },
  'General Studies': { icon: GraduationCap, tint: 'coral' },
}

// Cache the per-section counts so re-entering the page is instant.
let countsCache: Record<string, number> | null = null

/**
 * Group 2 / 2A PYQ — the four section papers (Aptitude, English, Tamil, General
 * Studies). Each row shows its total question count and opens the section page
 * (sub-types + exam-year filter).
 */
export default function PyqGroup2Page() {
  const navigate = useNavigate()
  const { t, lang } = useT()
  const [counts, setCounts] = useState<Record<string, number> | null>(countsCache)

  useEffect(() => {
    if (countsCache) return
    let cancelled = false
    Promise.all(
      PYQ2_SECTIONS.map((s) =>
        api
          .countQuestions({ category: 'pyq2', subject: s })
          .then((n) => [s, n] as const)
          .catch(() => [s, 0] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      const map = Object.fromEntries(pairs)
      countsCache = map
      setCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PickerPage badge={t('pyq2Badge')}>
      <div className="mb-5">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {t('pyq2PickSection')}
        </h2>
        <p className="tamil mt-1 font-body text-[15px] text-muted">{t('pyq2SectionHint')}</p>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-16">
          <LogoLoader size={56} />
        </div>
      ) : (
        <List>
          {PYQ2_SECTIONS.map((s, i) => {
            const { icon: Icon, tint } = SECTION_UI[s]
            const n = counts[s] ?? 0
            return (
              <ListRow
                key={s}
                disabled={n === 0}
                onClick={() => navigate(`/test-arena/pyq/group2/${pyq2SectionSlug(s)}`)}
                style={{ '--i': i } as React.CSSProperties}
                leading={
                  <IconTile tint={tint}>
                    <Icon size={19} strokeWidth={2} />
                  </IconTile>
                }
                title={subjectName(s, lang)}
                subtitle={
                  <span className="flex items-baseline gap-1">
                    <span className="font-heading font-bold tabular-nums text-primary">
                      {n.toLocaleString()}
                    </span>
                    <span>{t('questionsCount')}</span>
                  </span>
                }
              />
            )
          })}
        </List>
      )}
    </PickerPage>
  )
}
