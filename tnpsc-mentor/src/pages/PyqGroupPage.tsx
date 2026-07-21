import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calculator, Type, Languages, GraduationCap, type LucideIcon } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import { type Tint } from '../components/UI/IconTile'
import { ChoiceGrid, ChoiceCard } from '../components/UI/ChoiceCard'
import LogoLoader from '../components/UI/LogoLoader'
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
// so switching between Group 2 and Group 4 doesn't show the other's numbers.
const countsCache = new Map<string, Record<string, number>>()

/**
 * A section-wise PYQ group's paper list (Group 2 / 2A or Group 4 / VAO — see
 * PYQ_GROUPS). Each row shows its total question count and opens the section
 * page (sub-types + exam-year filter).
 */
export default function PyqGroupPage() {
  const { group: groupSlug } = useParams<{ group: string }>()
  const navigate = useNavigate()
  const { t, lang } = useT()

  const group = isPyqGroupKey(groupSlug) ? PYQ_GROUPS[groupSlug] : undefined
  const [counts, setCounts] = useState<Record<string, number> | null>(
    group ? countsCache.get(group.key) ?? null : {}
  )

  // Unknown group → back to the chooser.
  useEffect(() => {
    if (!group) navigate('/test-arena/pyq', { replace: true })
  }, [group, navigate])

  useEffect(() => {
    if (!group) return
    const cached = countsCache.get(group.key)
    if (cached) {
      setCounts(cached)
      return
    }
    setCounts(null)
    let cancelled = false
    Promise.all(
      group.sections.map((s) =>
        api
          .countQuestions({ category: group.category, subject: s })
          .then((n) => [s, n] as const)
          .catch(() => [s, 0] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      const map = Object.fromEntries(pairs)
      countsCache.set(group.key, map)
      setCounts(map)
    })
    return () => {
      cancelled = true
    }
  }, [group])

  if (!group) return null

  return (
    <PickerPage badge={t(group.i18n.badge)} backTo="/test-arena/pyq">
      <div className="mb-5">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {t('pyqPickSection')}
        </h2>
        <p className="tamil mt-1 font-body text-[15px] text-muted">{t(group.i18n.hint)}</p>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-16">
          <LogoLoader size={56} />
        </div>
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
                onClick={() => navigate(`/test-arena/pyq/${group.key}/${pyqSectionSlug(s)}`)}
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
