import { useState } from 'react'
import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import { NUMERICS_TOPICS, REASONING_TOPICS } from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

type AptType = 'numerics' | 'reasoning'

export default function AptitudePage() {
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
    <PickerPage badge={t('aptitudeBadge')}>
      {/* Sub-category pills */}
      <PillSection title={t('step1Category')} className="mb-8">
        <PillButton active={type === 'numerics'} onClick={() => setType('numerics')}>
          {t('numerics').toUpperCase()}
        </PillButton>
        <PillButton active={type === 'reasoning'} onClick={() => setType('reasoning')}>
          {t('reasoning').toUpperCase()}
        </PillButton>
      </PillSection>

      {/* Topics */}
      {type && (
        <PillSection
          title={`${t('step2Topic')} (${type === 'numerics' ? t('numerics') : t('reasoning')})`}
          className="animate-fadeIn"
        >
          {topics.map((topic) => (
            <PillButton key={topic} size="sm" onClick={() => handleTopic(topic)}>
              {topic.toUpperCase()}
            </PillButton>
          ))}
        </PillSection>
      )}
    </PickerPage>
  )
}
