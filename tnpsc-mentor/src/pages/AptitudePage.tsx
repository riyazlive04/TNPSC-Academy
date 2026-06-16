import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import { api } from '../lib/api'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

type AptType = 'numerics' | 'reasoning'

/**
 * Aptitude picker. Step 1 chooses the sub-category (Numerics / Reasoning); step 2
 * lists that sub-category's topics (e.g. Percentage, Coding-Decoding). Picking a
 * topic — or "All Topics" — starts a shuffled test scoped to that selection.
 */
export default function AptitudePage() {
  const startTest = useStartTest()
  const { t } = useT()

  const [type, setType] = useState<AptType | null>(null)
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load the chosen sub-category's topics.
  useEffect(() => {
    if (!type) return
    let cancelled = false
    setLoading(true)
    setError('')
    setTopics([])
    api
      .distinctTopics({ category: 'aptitude', aptitude_type: type })
      .then((tp) => !cancelled && setTopics(tp))
      .catch(() => !cancelled && setError('Could not load topics. Please try again.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [type])

  const begin = (topic: string | null) => {
    if (!type) return
    const typeLabel = type === 'numerics' ? 'Numerics' : 'Reasoning'
    startTest({
      category: 'aptitude',
      aptitude_type: type,
      aptitude_topic: topic ?? undefined,
      label: `Aptitude · ${typeLabel}${topic ? ` · ${topic}` : ''}`,
    })
  }

  return (
    <PickerPage badge={t('aptitudeBadge')}>
      {/* Step 1 — sub-category */}
      <PillSection title={t('step1Category')} className="mb-8">
        <PillButton
          active={type === 'numerics'}
          onClick={() => setType('numerics')}
        >
          {t('numerics').toUpperCase()}
        </PillButton>
        <PillButton
          active={type === 'reasoning'}
          onClick={() => setType('reasoning')}
        >
          {t('reasoning').toUpperCase()}
        </PillButton>
      </PillSection>

      {/* Step 2 — topic */}
      {type && (
        <PillSection title={t('step3Topic')} className="animate-fadeIn" wrap={false}>
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 size={28} className="animate-spin text-brand" />
            </div>
          )}
          {!loading && error && (
            <p className="text-center font-body text-sm text-coral">{error}</p>
          )}
          {!loading && !error && (
            <div className="flex flex-wrap justify-center gap-3">
              <PillButton size="sm" onClick={() => begin(null)}>
                {t('allTopics')}
              </PillButton>
              {topics.map((tp) => (
                <PillButton key={tp} size="sm" onClick={() => begin(tp)}>
                  {tp}
                </PillButton>
              ))}
            </div>
          )}
        </PillSection>
      )}
    </PickerPage>
  )
}
