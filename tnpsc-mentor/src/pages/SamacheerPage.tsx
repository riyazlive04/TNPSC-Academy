import { useEffect, useState } from 'react'
import { BookOpen, GraduationCap } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import LogoLoader from '../components/UI/LogoLoader'
import { ChoiceGrid, ChoiceCard } from '../components/UI/ChoiceCard'
import { SUBJECTS, STANDARDS, standardLabel, subjectName } from '../lib/constants'
import { iconFor } from '../lib/subjectIcons'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

const STEP_HEADING =
  'tamil mb-3 font-heading text-sm font-bold uppercase tracking-widest text-muted'

export default function SamacheerPage() {
  const startTest = useStartTest()
  const { t, lang } = useT()

  const [subject, setSubject] = useState<string | null>(null)
  const [standard, setStandard] = useState<number | null>(null)

  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch distinct topics for the chosen subject + standard.
  useEffect(() => {
    if (!subject || standard === null) return
    let cancelled = false
    const fetchTopics = async () => {
      setLoading(true)
      setError('')
      setTopics([])
      try {
        const distinct = await api.distinctTopics({
          category: 'samacheer',
          subject,
          standard,
        })
        if (!cancelled) setTopics(distinct)
      } catch {
        if (!cancelled) setError(t('couldNotLoad'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTopics()
    return () => {
      cancelled = true
    }
  }, [subject, standard])

  const handleTopic = (topic: string) => {
    if (!subject || standard === null) return
    startTest({
      category: 'samacheer',
      subject,
      standard,
      topic,
      label: `Samacheer · ${subject} · ${standardLabel(standard)} · ${topic}`,
    })
  }

  return (
    <PickerPage badge={t('samacheerBadge')}>
      {/* Row 1 - subject */}
      <section className="mb-8">
        <h3 className={STEP_HEADING}>{t('step1Subject')}</h3>
        <ChoiceGrid>
          {SUBJECTS.map((s, i) => (
            <ChoiceCard
              key={s}
              index={i}
              active={subject === s}
              onClick={() => {
                setSubject(s)
                setStandard(null)
                setTopics([])
              }}
              icon={iconFor(s) ?? <BookOpen />}
              title={subjectName(s, lang)}
            />
          ))}
        </ChoiceGrid>
      </section>

      {/* Row 2 - standard */}
      {subject && (
        <section className="mb-8 animate-fadeIn">
          <h3 className={STEP_HEADING}>{t('step2Standard')}</h3>
          <ChoiceGrid>
            {STANDARDS.map((n, i) => (
              <ChoiceCard
                key={n}
                index={i}
                active={standard === n}
                onClick={() => setStandard(n)}
                icon={iconFor(standardLabel(n)) ?? <GraduationCap />}
                title={standardLabel(n)}
              />
            ))}
          </ChoiceGrid>
        </section>
      )}

      {/* Row 3 - topics from DB */}
      {subject && standard !== null && (
        <PillSection
          title={`${t('step3Topic')} (${subject} · ${standardLabel(standard)})`}
          className="animate-fadeIn"
          wrap={false}
        >
          {loading && (
            <div className="flex justify-center py-8">
              <LogoLoader size={56} />
            </div>
          )}

          {!loading && error && (
            <p className="text-center font-body text-sm text-wrong">{error}</p>
          )}

          {!loading && !error && topics.length === 0 && (
            <p className="text-center font-body text-sm text-muted">
              No topics found for this subject & standard yet. Run the content
              upload, or pick another combination.
            </p>
          )}

          {!loading && topics.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {topics.map((topic) => (
                <PillButton key={topic} size="sm" onClick={() => handleTopic(topic)}>
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
