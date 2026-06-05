import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import PillButton from '../components/UI/PillButton'
import { NUMERICS_TOPICS, REASONING_TOPICS } from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

type AptType = 'numerics' | 'reasoning'

export default function AptitudePage() {
  const navigate = useNavigate()
  const startTest = useStartTest()
  const { t } = useT()
  const [type, setType] = useState<AptType | null>(null)

  const topics = type === 'numerics' ? NUMERICS_TOPICS : type === 'reasoning' ? REASONING_TOPICS : []

  const handleTopic = (topic: string) => {
    if (!type) return
    startTest({
      category: 'aptitude',
      aptitude_type: type,
      aptitude_topic: topic,
      label: `Aptitude · ${type === 'numerics' ? 'Numerics' : 'Reasoning'} · ${topic}`,
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
          <YellowBadge>{t('aptitudeBadge')}</YellowBadge>
        </div>

        {/* Sub-category pills */}
        <section className="mb-8">
          <h3 className="tamil mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-white/60">
            {t('step1Category')}
          </h3>
          <div className="flex justify-center gap-3">
            <PillButton active={type === 'numerics'} onClick={() => setType('numerics')}>
              {t('numerics').toUpperCase()}
            </PillButton>
            <PillButton active={type === 'reasoning'} onClick={() => setType('reasoning')}>
              {t('reasoning').toUpperCase()}
            </PillButton>
          </div>
        </section>

        {/* Topics */}
        {type && (
          <section className="animate-fadeIn">
            <h3 className="tamil mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-white/60">
              {t('step2Topic')} ({type === 'numerics' ? t('numerics') : t('reasoning')})
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {topics.map((topic) => (
                <PillButton key={topic} size="sm" onClick={() => handleTopic(topic)}>
                  {topic.toUpperCase()}
                </PillButton>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  )
}
