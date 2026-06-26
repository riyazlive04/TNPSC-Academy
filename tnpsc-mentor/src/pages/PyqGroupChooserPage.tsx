import { useNavigate } from 'react-router-dom'
import { Layers, BookCopy } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
import { useT } from '../lib/i18n'

/**
 * The PYQ entry point. Splits Previous-Year Questions into the two exam banks:
 * Group 1 (the existing subject-wise GS bank, category='pyq') and Group 2 / 2A
 * (the section-wise bank, category='pyq2'). Each row drills into its own flow.
 */
export default function PyqGroupChooserPage() {
  const navigate = useNavigate()
  const { t } = useT()

  return (
    <PickerPage badge={t('pyqBadge')}>
      <div className="mb-5">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {t('pyqChooseGroup')}
        </h2>
        <p className="tamil mt-1 font-body text-[15px] text-muted">{t('pyqChooseGroupHint')}</p>
      </div>

      <List>
        <ListRow
          onClick={() => navigate('/test-arena/pyq/group1')}
          style={{ '--i': 0 } as React.CSSProperties}
          leading={
            <IconTile tint="violet">
              <Layers size={19} strokeWidth={2} />
            </IconTile>
          }
          title={t('group1Pyq')}
          subtitle={t('group1PyqSub')}
        />
        <ListRow
          onClick={() => navigate('/test-arena/pyq/group2')}
          style={{ '--i': 1 } as React.CSSProperties}
          leading={
            <IconTile tint="blue">
              <BookCopy size={19} strokeWidth={2} />
            </IconTile>
          }
          title={t('group2Pyq')}
          subtitle={t('group2PyqSub')}
        />
      </List>
    </PickerPage>
  )
}
