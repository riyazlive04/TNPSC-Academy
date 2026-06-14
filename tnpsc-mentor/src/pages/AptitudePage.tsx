import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

type AptType = 'numerics' | 'reasoning'

/**
 * Aptitude picker. The bank is practised by sub-category only — picking
 * Numerics or Reasoning starts a shuffled test across every question of that
 * type (the imported PYQ-derived set is too finely tagged for a useful per-topic
 * step), so there is no topic drill-down.
 */
export default function AptitudePage() {
  const startTest = useStartTest()
  const { t } = useT()

  const begin = (type: AptType) => {
    startTest({
      category: 'aptitude',
      aptitude_type: type,
      label: `Aptitude · ${type === 'numerics' ? 'Numerics' : 'Reasoning'}`,
    })
  }

  return (
    <PickerPage badge={t('aptitudeBadge')}>
      <PillSection title={t('step1Category')}>
        <PillButton onClick={() => begin('numerics')}>{t('numerics').toUpperCase()}</PillButton>
        <PillButton onClick={() => begin('reasoning')}>{t('reasoning').toUpperCase()}</PillButton>
      </PillSection>
    </PickerPage>
  )
}
