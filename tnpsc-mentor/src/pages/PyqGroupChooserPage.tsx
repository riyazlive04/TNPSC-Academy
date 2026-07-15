import { useNavigate } from 'react-router-dom'
import { Layers, BookCopy, ClipboardList } from 'lucide-react'
import PickerPage from '../components/Layout/PickerPage'
import IconTile from '../components/UI/IconTile'
import { List, ListRow } from '../components/UI/ListRow'
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
        <ListRow
          onClick={() => navigate('/test-arena/pyq/group4')}
          style={{ '--i': 2 } as React.CSSProperties}
          leading={
            <IconTile tint="green">
              <ClipboardList size={19} strokeWidth={2} />
            </IconTile>
          }
          title={t('group4Pyq')}
          subtitle={t('group4PyqSub')}
        />
      </List>
    </PickerPage>
  )
}
