import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import PillButton from '../components/UI/PillButton'
import { SUBJECTS, STANDARDS, standardLabel } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

export default function SamacheerPage() {
  const navigate = useNavigate()
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
        const { data, error: err } = await supabase
          .from('questions')
          .select('topic')
          .eq('category', 'samacheer')
          .eq('subject', subject)
          .eq('standard', standard)
          .not('topic', 'is', null)
        if (err) throw err
        const distinct = Array.from(
          new Set((data ?? []).map((r: { topic: string | null }) => r.topic).filter(Boolean))
        ) as string[]
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
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-white/70 transition hover:text-accent"
        >
          <ArrowLeft size={16} /> {t('testArena')}
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>{t('samacheerBadge')}</YellowBadge>
        </div>

        {/* Row 1 — subject */}
        <section className="mb-8">
          <h3 className="tamil mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-white/60">
            {t('step1Subject')}
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
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
          </div>
        </section>

        {/* Row 2 — standard */}
        {subject && (
          <section className="mb-8 animate-fadeIn">
            <h3 className="tamil mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-white/60">
              {t('step2Standard')}
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {STANDARDS.map((n) => (
                <PillButton
                  key={n}
                  active={standard === n}
                  onClick={() => setStandard(n)}
                >
                  {standardLabel(n)}
                </PillButton>
              ))}
            </div>
          </section>
        )}

        {/* Row 3 — topics from DB */}
        {subject && standard !== null && (
          <section className="animate-fadeIn">
            <h3 className="tamil mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-white/60">
              {t('step3Topic')} ({subject} · {standardLabel(standard)})
            </h3>

            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 size={28} className="animate-spin text-accent" />
              </div>
            )}

            {!loading && error && (
              <p className="text-center font-body text-sm text-warn">{error}</p>
            )}

            {!loading && !error && topics.length === 0 && (
              <p className="text-center font-body text-sm text-white/60">
                No topics found for this subject & standard yet. Run the content
                upload, or pick another combination.
              </p>
            )}

            {!loading && topics.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {topics.map((t) => (
                  <PillButton key={t} size="sm" onClick={() => handleTopic(t)}>
                    {t.toUpperCase()}
                  </PillButton>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  )
}
