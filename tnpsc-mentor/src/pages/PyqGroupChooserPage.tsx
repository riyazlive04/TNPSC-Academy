import { useNavigate } from 'react-router-dom'
import PickerPage from '../components/Layout/PickerPage'
import { ChoiceGrid, ChoiceCard } from '../components/UI/ChoiceCard'
import { iconUrl } from '../lib/subjectIcons'
import { useT } from '../lib/i18n'

/**
 * The PYQ entry point. Splits Previous-Year Questions into the three exam banks:
 * Group 1 (the subject-wise GS bank, category='pyq'), Group 2 / 2A ('pyq2') and
 * Group 4 / VAO ('pyq4'). Group 1 has its own flow; the two section-wise groups
 * share theirs (see PYQ_GROUPS in lib/constants).
 */
export default function PyqGroupChooserPage() {
  const navigate = useNavigate()
  const { t } = useT()

  return (
    <PickerPage badge={t('pyqBadge')}>
      <div className="mb-5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          {t('pyqChooseGroup')}
        </h2>
        <p className="tamil mt-1 font-body text-base text-muted">{t('pyqChooseGroupHint')}</p>
      </div>

      <ChoiceGrid>
        <ChoiceCard
          index={0}
          onClick={() => navigate('/test-arena/pyq/group1')}
          icon={iconUrl('pyq-group-1')}
          tint="violet"
          title={t('group1Pyq')}
          subtitle={t('group1PyqSub')}
        />
        <ChoiceCard
          index={1}
          onClick={() => navigate('/test-arena/pyq/group2')}
          icon={iconUrl('pyq-group-2')}
          tint="blue"
          title={t('group2Pyq')}
          subtitle={t('group2PyqSub')}
        />
        <ChoiceCard
          index={2}
          onClick={() => navigate('/test-arena/pyq/group4')}
          icon={iconUrl('pyq-group-4')}
          tint="green"
          title={t('group4Pyq')}
          subtitle={t('group4PyqSub')}
        />
      </ChoiceGrid>
    </PickerPage>
  )
}
