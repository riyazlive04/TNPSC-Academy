import { useNavigate } from 'react-router-dom'
import PickerPage from '../components/Layout/PickerPage'
import PillButton from '../components/UI/PillButton'
import PillSection from '../components/UI/PillSection'
import { PYQ_SUBJECTS } from '../lib/constants'
import { useStartTest } from '../hooks/useStartTest'
import { useT } from '../lib/i18n'

// The History PYQ subject is split by period — picking it opens the
// Ancient/Medieval/Modern selector instead of starting a test directly.
const HISTORY_SUBJECT = 'History and INM'

export default function PreviousYearPage() {
  const startTest = useStartTest()
  const navigate = useNavigate()
  const { t } = useT()

  const begin = (subj: string) => {
    if (subj === HISTORY_SUBJECT) {
      navigate('/test-arena/pyq/history')
      return
    }
    startTest({
      category: 'pyq',
      subject: subj,
      label: `PYQ · ${subj}`,
    })
  }

  return (
    <PickerPage badge={t('pyqBadge')}>
      <PillSection title={t('step1Subject')}>
        {PYQ_SUBJECTS.map((s) => (
          <PillButton key={s} size="sm" onClick={() => begin(s)}>
            {s.toUpperCase()}
          </PillButton>
        ))}
      </PillSection>
    </PickerPage>
  )
}
