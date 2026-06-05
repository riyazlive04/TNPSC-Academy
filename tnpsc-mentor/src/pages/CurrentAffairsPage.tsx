import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Info, Loader2 } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import PillButton from '../components/UI/PillButton'
import { CA_MONTHS, CA_TOPIC_CATEGORIES } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useStartTest } from '../hooks/useStartTest'

type CAView = 'month_wise' | 'topic_wise'

export default function CurrentAffairsPage() {
  const navigate = useNavigate()
  const startTest = useStartTest()
  const [view, setView] = useState<CAView>('month_wise')

  // Topic-wise: distinct ca_topic values from the DB.
  const [topics, setTopics] = useState<string[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [topicError, setTopicError] = useState('')

  useEffect(() => {
    if (view !== 'topic_wise') return
    let cancelled = false
    const fetchTopics = async () => {
      setLoadingTopics(true)
      setTopicError('')
      try {
        const { data, error } = await supabase
          .from('questions')
          .select('ca_topic')
          .eq('category', 'current_affairs')
          .eq('ca_type', 'topic_wise')
          .not('ca_topic', 'is', null)
        if (error) throw error
        const distinct = Array.from(
          new Set((data ?? []).map((r: { ca_topic: string | null }) => r.ca_topic).filter(Boolean))
        ) as string[]
        if (!cancelled) {
          // Fall back to the curated category list if the DB has none yet.
          setTopics(distinct.length ? distinct : CA_TOPIC_CATEGORIES)
        }
      } catch (e) {
        if (!cancelled) {
          setTopicError('Could not load topics from the database. Showing default categories.')
          setTopics(CA_TOPIC_CATEGORIES)
        }
      } finally {
        if (!cancelled) setLoadingTopics(false)
      }
    }
    fetchTopics()
    return () => {
      cancelled = true
    }
  }, [view])

  const handleMonth = (label: string) => {
    startTest({
      category: 'current_affairs',
      ca_type: 'month_wise',
      ca_month: label,
      label: `Current Affairs · ${label}`,
    })
  }

  const handleTopic = (topic: string) => {
    startTest({
      category: 'current_affairs',
      ca_type: 'topic_wise',
      ca_topic: topic,
      label: `Current Affairs · ${topic}`,
    })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={() => navigate('/test-arena')}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-white/70 transition hover:text-accent"
        >
          <ArrowLeft size={16} /> Test Arena
        </button>

        <div className="mb-8 text-center">
          <YellowBadge>Current Affairs</YellowBadge>
        </div>

        {/* Sub-category pills */}
        <div className="mb-8 flex justify-center gap-3">
          <PillButton active={view === 'topic_wise'} onClick={() => setView('topic_wise')}>
            TOPIC WISE
          </PillButton>
          <PillButton active={view === 'month_wise'} onClick={() => setView('month_wise')}>
            MONTH WISE
          </PillButton>
        </div>

        {view === 'month_wise' && (
          <section className="animate-fadeIn">
            <h3 className="mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-white/60">
              Select Month (August 2025 → June 2026)
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {CA_MONTHS.map((m) => (
                <PillButton key={m.slug} size="sm" onClick={() => handleMonth(m.label)}>
                  {m.label}
                </PillButton>
              ))}
            </div>
          </section>
        )}

        {view === 'topic_wise' && (
          <section className="animate-fadeIn">
            <div className="mx-auto mb-5 flex max-w-2xl items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <Info size={18} className="mt-0.5 flex-shrink-0 text-accent" />
              <p className="font-body text-sm text-white/70">
                Topic-wise content is manually curated (refer to the Word document
                uploaded in the Drive "Current Affairs" folder). The topics below
                reflect what is currently available in the database.
              </p>
            </div>

            {topicError && (
              <p className="mb-4 text-center font-body text-sm text-warn">{topicError}</p>
            )}

            {loadingTopics ? (
              <div className="flex justify-center py-8">
                <Loader2 size={28} className="animate-spin text-accent" />
              </div>
            ) : (
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
