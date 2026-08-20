import { CalendarDays, CheckCircle2, Clock, FileText, Lock } from 'lucide-react'
import { useT } from '../../lib/i18n'
import type { Lang } from '../../store/languageStore'
import type { TestSeriesItem } from '../../types'

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_TA = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச']

/** Format 'YYYY-MM-DD' as "09 Jul" / "09 ஜூலை" (used for schedule badges). */
function formatDate(iso: string | null, lang: Lang): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const months = lang === 'ta' ? MONTHS_TA : MONTHS_EN
  return `${String(d).padStart(2, '0')} ${months[m - 1]}`
}

/**
 * The poster-style test card grid shared by every scheduled test-series page
 * (Test Marathon, Rank Booster, …): unit chip, subject summary, Q/min/date
 * tags, status (Available/Unlocks DD Mon/Completed/locked), Start CTA. Locked
 * cards stay tappable — the tap opens whatever paywall the caller wires up via
 * `onLockedTap` (a bundle purchase unlocks the whole series).
 */
export default function TestSeriesGrid({
  tests,
  onLaunch,
  onLockedTap,
}: {
  tests: TestSeriesItem[]
  onLaunch: (tst: TestSeriesItem) => void
  /** Called instead of `onLaunch` when the card is bundle-locked (not date-locked). */
  onLockedTap: () => void
}) {
  const { t, lang } = useT()

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
      {tests.map((tst) => {
        const title = lang === 'ta' && tst.title_ta ? tst.title_ta : tst.title
        const unit = lang === 'ta' && tst.unit_label_ta ? tst.unit_label_ta : tst.unit_label
        const subjects =
          lang === 'ta' && tst.subjects_label_ta ? tst.subjects_label_ta : tst.subjects_label
        const minutes = Math.round(tst.duration_seconds / 60)
        const exhausted = tst.attemptsUsed >= tst.attemptsMax
        const disabled = tst.locked || exhausted
        const dateLocked = tst.lockReason === 'date'
        const premiumLocked = tst.lockReason === 'premium'
        return (
          <div
            key={tst.id}
            className={[
              'flex h-full flex-col rounded-card border border-line bg-card p-2.5 shadow-soft transition-shadow sm:p-4',
              disabled ? 'opacity-80' : 'hover:shadow-card',
            ].join(' ')}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="tamil font-heading text-sm font-semibold text-ink [overflow-wrap:anywhere] sm:text-base">
                  {title}
                </h3>
                {unit && (
                  <span className="tamil inline-flex min-w-0 max-w-full items-center rounded-md bg-brand-soft px-2 py-0.5 font-heading text-2xs font-semibold text-brand-dark [overflow-wrap:anywhere]">
                    {unit}
                  </span>
                )}
                {premiumLocked && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accentwarmsoft px-2 py-0.5 font-heading text-2xs font-semibold text-accentwarm">
                    <Lock size={11} /> {t('premiumOnly')}
                  </span>
                )}
                {/* The trial paper: always flag it FREE on the card so the offer
                    is visible to everyone (paid/staff owners included). */}
                {tst.tier === 'free' && (
                  <span className="tamil inline-flex shrink-0 items-center rounded-md bg-mintsoft px-2 py-0.5 font-heading text-2xs font-bold uppercase text-mint">
                    {t('marathonFreeBadge')}
                  </span>
                )}
              </div>

              {subjects && (
                <p className="tamil mt-1 font-body text-xs leading-snug text-ink2">{subjects}</p>
              )}

              {/* Meta kept to TWO lines on the narrow card: questions + duration
                  on row 1; date + attempts on row 2. */}
              <div className="mt-1.5 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag>
                    <FileText size={12} /> {tst.total_questions} Q
                  </Tag>
                  <Tag>
                    <Clock size={12} /> {minutes} {t('minutesUnit')}
                  </Tag>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  {tst.scheduled_date && (
                    <Tag>
                      <CalendarDays size={12} /> {formatDate(tst.scheduled_date, lang)}
                    </Tag>
                  )}
                  <span className="inline-flex items-center gap-1 font-body text-2xs text-ink2">
                    {exhausted ? (
                      <>
                        <CheckCircle2 size={12} className="text-correct" /> {t('examCompleted')}
                      </>
                    ) : (
                      `${t('attemptWord')} ${tst.attemptsUsed}/${tst.attemptsMax}`
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA + locked note, pinned to the card bottom. */}
            <div className="mt-auto pt-2.5">
              {dateLocked && (
                <p className="tamil mb-2 flex items-center gap-1.5 font-body text-xs text-ink2">
                  <Lock size={12} /> {t('unlocksOn')} {formatDate(tst.scheduled_date, lang)}
                </p>
              )}
              {premiumLocked && (
                <p className="tamil mb-2 font-body text-xs text-ink2">{t('testSeriesLockedPremium')}</p>
              )}
              {/* Bundle-locked papers stay tappable: the tap opens the forced
                  upsell. Date locks and the attempt cap remain true dead ends. */}
              <button
                onClick={() => (premiumLocked ? onLockedTap() : !disabled && onLaunch(tst))}
                disabled={exhausted || dateLocked}
                className="btn-brand w-full whitespace-normal px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                {exhausted ? t('examCompleted') : t('startExam')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-tint px-2 py-1 font-heading text-2xs font-medium uppercase text-ink2">
      {children}
    </span>
  )
}
