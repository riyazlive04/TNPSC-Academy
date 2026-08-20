import { useNavigate } from 'react-router-dom'
import { ListChecks, Newspaper, FileText } from 'lucide-react'
import BottomSheet from './BottomSheet'
import IconTile from '../UI/IconTile'
import { CardList, CardRow } from '../UI/CardRow'
import { useT } from '../../lib/i18n'

/**
 * The dashboard's single "Current Affairs" card used to fan out into three
 * separate rows (Daily CA Test, Current Affairs, CA Questions) - the same
 * newspaper-shaped content read three different ways. This sheet keeps that
 * one card on the dashboard and surfaces the three as clearly-labelled,
 * differentiated actions instead.
 */
export default function CurrentAffairsHubSheet({
  open,
  onClose,
  onOpenDaily,
  topicPracticeCount,
}: {
  open: boolean
  onClose: () => void
  /** Fires after this sheet closes, to open the Daily CA day picker. */
  onOpenDaily: () => void
  /** Live bank size for the topic-practice row; omitted while it's loading. */
  topicPracticeCount?: number
}) {
  const { t } = useT()
  const navigate = useNavigate()

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('currentAffairsTitle')}>
      <CardList>
        <CardRow
          leading={
            <IconTile tint="green">
              <ListChecks size={20} />
            </IconTile>
          }
          title={t('caDailyTitle')}
          subtitle={t('caDailyCardSub')}
          onClick={() => {
            onClose()
            onOpenDaily()
          }}
        />
        <CardRow
          style={{ '--i': 1 } as React.CSSProperties}
          leading={
            <IconTile tint="blue">
              <Newspaper size={20} />
            </IconTile>
          }
          title={t('caTopicPracticeTitle')}
          subtitle={
            topicPracticeCount != null
              ? `${topicPracticeCount} ${t('questionsCount')} · ${t('caTopicPracticeSub')}`
              : t('caTopicPracticeSub')
          }
          onClick={() => go('/test-arena/current-affairs')}
        />
        <CardRow
          style={{ '--i': 2 } as React.CSSProperties}
          leading={
            <IconTile tint="coral">
              <FileText size={20} />
            </IconTile>
          }
          title={t('caQuestionsTitle')}
          subtitle={t('caQuestionsArenaSub')}
          onClick={() => go('/test-arena/ca-questions')}
        />
      </CardList>
    </BottomSheet>
  )
}
