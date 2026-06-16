import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import { api } from '../lib/api'
import {
  SUBJECT_PRACTICE_ORDER,
  SUBJECT_TOPIC_ORDER,
  SUBJECT_TOPIC_GROUPS,
  bySyllabusOrder,
  groupTopics,
} from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT, type StringKey } from '../lib/i18n'
import type { SubjectQType } from '../types'

// The five testable question styles, in display order. `key` is null for the
// "Mixed" option (no question_type filter — pools every style for the topic).
const QTYPES: { key: SubjectQType | null; labelKey: StringKey }[] = [
  { key: null, labelKey: 'typeMixed' },
  { key: 'chronological', labelKey: 'typeChronological' },
  { key: 'match', labelKey: 'typeMatch' },
  { key: 'assertion_reason', labelKey: 'typeAssertionReason' },
  { key: 'statements', labelKey: 'typeStatements' },
  { key: 'direct', labelKey: 'typeDirect' },
]

const ALL_TOPICS = '__all__'

export default function SubjectPracticePage() {
  const startTest = useStartTest()
  const { t } = useT()

  const [subjects, setSubjects] = useState<{ subject: string; total: number }[]>([])
  const [subject, setSubject] = useState<string | null>(null)
  const [topic, setTopic] = useState<string | null>(null) // null = none picked; ALL_TOPICS = all
  // For subjects split into sub-groups (e.g. Geography → Physical / Human), the
  // chosen group heading. Topics are only revealed once a group is picked.
  const [subgroup, setSubgroup] = useState<string | null>(null)

  const [topics, setTopics] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})

  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — subjects (once).
  useEffect(() => {
    let cancelled = false
    api
      .subjects()
      .then((s) => {
        if (cancelled) return
        // Re-order subjects into TNPSC syllabus sequence (unmapped sink to end).
        const order = bySyllabusOrder(
          s.map((r) => r.subject),
          SUBJECT_PRACTICE_ORDER
        )
        setSubjects([...s].sort((a, b) => order.indexOf(a.subject) - order.indexOf(b.subject)))
      })
      .catch(() => !cancelled && setError('Could not load subjects. Please try again.'))
      .finally(() => !cancelled && setLoadingSubjects(false))
    return () => {
      cancelled = true
    }
  }, [])

  // Step 2 — topics for the chosen subject.
  useEffect(() => {
    if (!subject) return
    let cancelled = false
    setLoadingTopics(true)
    setError('')
    setTopics([])
    api
      .distinctTopics({ category: 'subject', subject })
      .then((tp) => !cancelled && setTopics(bySyllabusOrder(tp, SUBJECT_TOPIC_ORDER[subject])))
      .catch(() => !cancelled && setError('Could not load topics. Please try again.'))
      .finally(() => !cancelled && setLoadingTopics(false))
    return () => {
      cancelled = true
    }
  }, [subject])

  // Step 3 — per-type counts for subject (+ topic when a specific one is picked).
  useEffect(() => {
    if (!subject || !topic) return
    let cancelled = false
    setCounts({})
    api
      .questionTypeCounts({ subject, topic: topic === ALL_TOPICS ? undefined : topic })
      .then((c) => !cancelled && setCounts(c))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [subject, topic])

  const handleType = (qtype: SubjectQType | null, label: string) => {
    if (!subject || !topic) return
    const isAll = topic === ALL_TOPICS
    startTest({
      category: 'subject',
      subject,
      topic: isAll ? undefined : topic,
      question_type: qtype ?? undefined,
      label: `${subject} · ${isAll ? t('allTopics') : topic} · ${label}`,
    })
  }

  const totalForType = (key: SubjectQType | null): number => {
    if (key) return counts[key] ?? 0
    return Object.values(counts).reduce((s, n) => s + n, 0) // Mixed = sum of all
  }

  // Topics split into syllabus sub-groups (e.g. Geography → Physical / Human).
  // Subjects without a grouping config yield a single null-headed group.
  const topicGroups = useMemo(
    () => groupTopics(topics, subject ? SUBJECT_TOPIC_GROUPS[subject] : undefined),
    [topics, subject]
  )
  const grouped = topicGroups.length > 1 || topicGroups[0]?.heading != null

  return (
    <PickerPage badge={t('subjectPracticeBadge')}>
      {/* Step 1 — subject */}
      <PillSection title={t('step1Subject')} className="mb-8" wrap={false}>
        {loadingSubjects ? (
          <div className="flex justify-center py-8">
            <Loader2 size={28} className="animate-spin text-brand" />
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {subjects.map((s) => (
              <PillButton
                key={s.subject}
                size="sm"
                active={subject === s.subject}
                onClick={() => {
                  setSubject(s.subject)
                  setTopic(null)
                  setSubgroup(null)
                  setCounts({})
                }}
              >
                {s.subject}
              </PillButton>
            ))}
          </div>
        )}
      </PillSection>

      {/* Step 2 — topic */}
      {subject && (
        <PillSection title={t('step3Topic')} className="mb-8 animate-fadeIn" wrap={false}>
          {loadingTopics && (
            <div className="flex justify-center py-8">
              <Loader2 size={28} className="animate-spin text-brand" />
            </div>
          )}
          {!loadingTopics && error && (
            <p className="text-center font-body text-sm text-coral">{error}</p>
          )}
          {!loadingTopics && !error && !grouped && (
            <div className="flex flex-wrap justify-center gap-3">
              <PillButton
                size="sm"
                active={topic === ALL_TOPICS}
                onClick={() => setTopic(ALL_TOPICS)}
              >
                {t('allTopics')}
              </PillButton>
              {topics.map((tp) => (
                <PillButton key={tp} size="sm" active={topic === tp} onClick={() => setTopic(tp)}>
                  {tp}
                </PillButton>
              ))}
            </div>
          )}
          {!loadingTopics && !error && grouped && (
            <div className="space-y-6">
              {/* Pick a sub-group first (e.g. Physical / Human Geography). The
                  group's topics are only revealed once a group is chosen. */}
              <div className="flex flex-wrap justify-center gap-3">
                <PillButton
                  size="sm"
                  active={topic === ALL_TOPICS}
                  onClick={() => {
                    setSubgroup(null)
                    setTopic(ALL_TOPICS)
                  }}
                >
                  {t('allTopics')}
                </PillButton>
                {topicGroups.map((g) => (
                  <PillButton
                    key={g.heading ?? 'more'}
                    size="sm"
                    active={subgroup === g.heading}
                    onClick={() => {
                      setSubgroup(g.heading)
                      setTopic(null)
                    }}
                  >
                    {g.heading}
                  </PillButton>
                ))}
              </div>

              {/* Topics within the chosen sub-group */}
              {subgroup && (
                <div className="flex flex-wrap justify-center gap-3 animate-fadeIn">
                  {(topicGroups.find((g) => g.heading === subgroup)?.topics ?? []).map((tp) => (
                    <PillButton
                      key={tp}
                      size="sm"
                      active={topic === tp}
                      onClick={() => setTopic(tp)}
                    >
                      {tp}
                    </PillButton>
                  ))}
                </div>
              )}
            </div>
          )}
        </PillSection>
      )}

      {/* Step 3 — question type */}
      {subject && topic && (
        <PillSection title={t('step3Type')} className="animate-fadeIn" wrap={false}>
          <div className="flex flex-wrap justify-center gap-3">
            {QTYPES.map(({ key, labelKey }) => {
              const n = totalForType(key)
              const label = t(labelKey)
              return (
                <PillButton
                  key={labelKey}
                  size="md"
                  disabled={n === 0}
                  onClick={() => handleType(key, label)}
                >
                  {label} {n > 0 && <span className="opacity-60">· {n}</span>}
                </PillButton>
              )
            })}
          </div>
        </PillSection>
      )}
    </PickerPage>
  )
}
