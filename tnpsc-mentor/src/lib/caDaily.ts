import { issueDateLabel } from './caMagazine'
import type { CaDailySet } from './api'
import type { Lang } from '../store/languageStore'
import type { QuizConfig } from '../types'

/**
 * The quiz config for one published daily Current-Affairs set. Shared by every
 * surface that can launch a day's paper (the dashboard's day picker and the CA
 * Questions page), so they can't drift on how the test is scoped or labelled.
 *
 * `caDailyId` is what routes the draw and the grading through
 * /api/ca-questions/daily/* — these questions live in `ca_daily_questions`, not
 * in the main bank (see APP_INTEGRATION.md §D).
 */
export function dailyCaConfig(set: CaDailySet, lang: Lang): QuizConfig {
  return {
    category: 'current_affairs',
    ca_type: 'day_wise',
    caDailyId: set.id,
    caDailyDate: set.date,
    // The set is fixed and its size already known — the setup screen shows the
    // slider bound instantly instead of counting against the main bank.
    availableCount: set.total,
    questionCount: set.total,
    labelParts: [{ t: 'caDailyTitle' }, issueDateLabel('day_wise', set.date, lang)],
  }
}
