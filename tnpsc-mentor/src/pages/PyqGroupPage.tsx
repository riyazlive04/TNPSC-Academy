import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Calculator, Type, Languages, GraduationCap, type LucideIcon } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import { type Tint } from '../components/UI/IconTile'
import { ChoiceGrid, ChoiceCard } from '../components/UI/ChoiceCard'
import { SkeletonChoiceGrid } from '../components/UI/Skeleton'
import { YearFilter, parseYearParam, withYear } from '../components/UI/YearFilter'
import { usePyqYears } from '../hooks/usePyqYears'
import { iconFor } from '../lib/subjectIcons'
import { api } from '../lib/api'
import {
  PYQ_GROUPS,
  isPyqGroupKey,
  pyqSectionSlug,
  subjectName,
  type PyqSection,
} from '../lib/constants'
import { useT } from '../lib/i18n'

// Section → row presentation (icon + tint). The data behind each is fetched as a
// single count per section (category=<group>, subject=section).
const SECTION_UI: Record<PyqSection, { icon: LucideIcon; tint: Tint }> = {
  Aptitude: { icon: Calculator, tint: 'violet' },
  English: { icon: Type, tint: 'blue' },
  Tamil: { icon: Languages, tint: 'green' },
  'General Studies': { icon: GraduationCap, tint: 'coral' },
}

// Cache the per-section counts so re-entering a group is instant. Keyed by group
// AND year so switching between Group 2 and Group 4 — or between years — doesn't
// show the other's numbers.
const countsCache = new Map<string, Record<string, number>>()
const cacheKey = (groupKey: string, year: number | null) => `${groupKey}|${year ?? 'all'}`

/**
 * A section-wise PYQ group's paper list (Group 2 / 2A or Group 4 / VAO — see
 * PYQ_GROUPS). Each row shows its question count and opens the section page
 * (sub-types + the same exam-year filter).
 *
 * The year lives in the URL (`?year=`) rather than in state, so it survives the
 * round trip into a section and back, and so a shared link keeps its filter. It
 * is carried onto the section page, which reads the same param.
 */
export default function PyqGroupPage() {
  const { group: groupSlug } = useParams<{ group: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t, lang } = useT()

  const group = isPyqGroupKey(groupSlug) ? PYQ_GROUPS[groupSlug] : undefined
  const years = usePyqYears(group?.category)
  const year = parseYearParam(searchParams.get('year'), years)
  const setYear = (y: number | null) => {
    const next = new URLSearchParams(searchParams)
    if (y) next.set('year', String(y))
    else next.delete('year')
    setSearchParams(next, { replace: true })
  }

  const [counts, setCounts] = useState<Record<string, number> | null>(
    group ? countsCache.get(cacheKey(group.key, year)) ?? null : {}
  )

  // Unknown group → back to the chooser.
  useEffect(() => {
    if (!group) navigate('/test-arena/pyq', { replace: true })
  }, [group, navigate])

  useEffect(() => {
    if (!group) return
    const key = cacheKey(group.key, year)
    const cached = countsCache.get(key)
    if (cached) {
      setCounts(cached)
      return
    }
    setCounts(null)
    let cancelled = false
    Promise.all(
      group.sections.map((s) =>
        api
          .countQuestions({ category: group.category, subject: s, year: year ?? undefined })
          .then((n) => [s, n] as const)
          .catch(() => [s, 0] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      const map = Object.fromEntries(pairs)
      countsCache.set(key, map)
      setCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [group, year])

  if (!group) return null

  return (
    <PickerPage badge={t(group.i18n.badge)} backTo="/test-arena/pyq">
      <div className="mb-5">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {t('pyqPickSection')}
        </h2>
        <p className="tamil mt-1 font-body text-[15px] text-muted">{t(group.i18n.hint)}</p>
      </div>

      {/* Exam-year filter. Scopes the section counts below and is carried into
          whichever section is opened. */}
      <YearFilter years={years} value={year} onChange={setYear} />

      {counts === null ? (
        // Same grid the sections land in, so nothing shifts when they arrive.
        <SkeletonChoiceGrid count={group.sections.length} />
      ) : (
        <ChoiceGrid>
          {group.sections.map((s, i) => {
            const { icon: Icon, tint } = SECTION_UI[s]
            const n = counts[s] ?? 0
            return (
              <ChoiceCard
                key={s}
                index={i}
                disabled={n === 0}
                onClick={() =>
                  navigate(withYear(`/test-arena/pyq/${group.key}/${pyqSectionSlug(s)}`, year))
                }
                icon={iconFor(s) ?? <Icon strokeWidth={2} />}
                tint={tint}
                title={subjectName(s, lang)}
                count={n}
                countLabel={t('questionsCount')}
              />
            )
          })}
        </ChoiceGrid>
      )}
    </PickerPage>
  )
}
