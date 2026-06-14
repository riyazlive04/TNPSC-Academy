import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import { GROUPS, GROUP_SUBJECTS, groupLabel } from '../lib/constants'
import type { GroupType } from '../types'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

// Subjects that drill down to a data-driven topic step before starting a test.
// Aptitude's imported PYQ bank carries fine-grained topics worth practising
// individually; every other subject starts straight from the subject pill.
const TOPIC_DRILLDOWN_SUBJECTS = ['Aptitude']

export default function PreviousYearPage() {
  const startTest = useStartTest()
  const { t } = useT()
  const [selectedGroup, setSelectedGroup] = useState<GroupType | null>(null)
  const [subject, setSubject] = useState<string | null>(null)

  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subjects = selectedGroup ? GROUP_SUBJECTS[selectedGroup] : []
  const drillTopics = subject !== null && TOPIC_DRILLDOWN_SUBJECTS.includes(subject)

  const begin = (subj: string, topic?: string) => {
    if (!selectedGroup) return
    startTest({
      category: 'pyq',
      group_type: selectedGroup,
      subject: subj,
      ...(topic ? { topic } : {}),
      label: `PYQ · ${groupLabel(selectedGroup)} · ${subj}${topic ? ` · ${topic}` : ''}`,
    })
  }

  const handleSubject = (subj: string) => {
    // Topic-drilldown subjects reveal a topic step; others start immediately.
    if (TOPIC_DRILLDOWN_SUBJECTS.includes(subj)) {
      setSubject(subj)
      setTopics([])
      return
    }
    setSubject(subj)
    begin(subj)
  }

  // Load distinct topics for a drilldown subject (Aptitude) from the DB.
  useEffect(() => {
    if (!selectedGroup || !subject || !drillTopics) return
    let cancelled = false
    const fetchTopics = async () => {
      setLoading(true)
      setError('')
      setTopics([])
      try {
        const distinct = await api.distinctTopics({ category: 'pyq', subject })
        if (!cancelled) setTopics(distinct)
      } catch {
        if (!cancelled) setError('Could not load topics from the database. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTopics()
    return () => {
      cancelled = true
    }
  }, [selectedGroup, subject, drillTopics])

  return (
    <PickerPage badge={t('pyqBadge')}>
      {/* Row 1 — group selection */}
      <PillSection title={t('step1Group')} className="mb-8">
        {GROUPS.map((g) => (
          <PillButton
            key={g.id}
            active={selectedGroup === g.id}
            onClick={() => {
              setSelectedGroup(g.id)
              setSubject(null)
              setTopics([])
            }}
          >
            {g.label}
          </PillButton>
        ))}
      </PillSection>

      {/* Row 2 — subjects (only when a group is selected) */}
      {selectedGroup && (
        <PillSection
          title={`${t('step2Subject')} (${groupLabel(selectedGroup)})`}
          className="mb-8 animate-fadeIn"
        >
          {subjects.map((s) => (
            <PillButton key={s} size="sm" active={subject === s} onClick={() => handleSubject(s)}>
              {s.toUpperCase()}
            </PillButton>
          ))}
        </PillSection>
      )}

      {/* Row 3 — topics from DB (drilldown subjects only) */}
      {selectedGroup && subject && drillTopics && (
        <PillSection
          title={`${t('step3Topic')} (${subject})`}
          className="animate-fadeIn"
          wrap={false}
        >
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 size={28} className="animate-spin text-brand" />
            </div>
          )}

          {!loading && error && (
            <p className="text-center font-body text-sm text-coral">{error}</p>
          )}

          {!loading && !error && topics.length === 0 && (
            <p className="text-center font-body text-sm text-ink2">
              No topics found for this subject yet.
            </p>
          )}

          {!loading && topics.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {/* Full mixed test across every topic. */}
              <PillButton size="sm" active onClick={() => begin(subject)}>
                {t('allTopics').toUpperCase()}
              </PillButton>
              {topics.map((topic) => (
                <PillButton key={topic} size="sm" onClick={() => begin(subject, topic)}>
                  {topic.toUpperCase()}
                </PillButton>
              ))}
            </div>
          )}
        </PillSection>
      )}
    </PickerPage>
  )
}
