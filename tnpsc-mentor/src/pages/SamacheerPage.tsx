import { useEffect, useState } from 'react'
import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import LogoLoader from '../components/UI/LogoLoader'
import { SUBJECTS, STANDARDS, standardLabel } from '../lib/constants'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

export default function SamacheerPage() {
  const startTest = useStartTest()
  const { t } = useT()

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
      <PillSection title={t('step1Subject')} className="mb-8">
        {SUBJECTS.map((s) => (
          <PillButton
            key={s}
            size="sm"
            active={subject === s}
            onClick={() => {
              setSubject(s)
              setStandard(null)
              setTopics([])
            }}
          >
            {s.toUpperCase()}
          </PillButton>
        ))}
      </PillSection>

      {/* Row 2 - standard */}
      {subject && (
        <PillSection title={t('step2Standard')} className="mb-8 animate-fadeIn">
          {STANDARDS.map((n) => (
            <PillButton key={n} active={standard === n} onClick={() => setStandard(n)}>
              {standardLabel(n)}
            </PillButton>
          ))}
        </PillSection>
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
