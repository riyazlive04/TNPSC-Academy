import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, FileText, ListChecks, Lock } from 'lucide-react'
import PremiumCard from '../UI/PremiumCard'
import PurchaseConfirmModal from '../UI/PurchaseConfirmModal'
import { SkeletonCards } from '../UI/Skeleton'
import { api } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { usePlanSales } from '../../hooks/usePlanSales'
import { useMockPackPurchase, MOCK_PACK_PRICE_RUPEES } from '../../hooks/useMockPackPurchase'
import { upsell } from '../../store/upsellStore'
import { useT } from '../../lib/i18n'
import type { MockExam, QuizConfig } from '../../types'

/**
 * The six full-length Group 1 mock papers: the list, the per-exam lock state,
 * and the ₹399 pack's paywall and checkout.
 *
 * Lifted out of MockTestPage so the Test Series hub can show the same papers
 * under its Group 1 tab. Both places need every part of this — the attempt
 * counts, the locked-tap-to-buy behaviour and the confirm modal — so it moves
 * whole rather than being partly reimplemented in the second location.
 */
export default function FullMockExamList() {
  const navigate = useNavigate()
  const { t, lang } = useT()
  // "Preview as student": the server resolves `locked` from the REAL role and
  // staff bypass the tier gate, so every exam comes back unlocked for an admin
  // and the picker looks nothing like a learner's. Re-derive the lock here from
  // the exam's own tier, which the API returns regardless. Presentation only —
  // the same approach TestSeriesProductPanel takes with `previewLocked`.
  const { previewAsStudent } = useAuth()
  // Tapping a locked exam has to lead somewhere buyable. The ₹399 Group 1 Mock
  // Test Pack IS these papers, so the tap opens its confirm → Razorpay flow
  // directly — the same machinery the Test Marathon banner uses. If the pack is
  // off sale, fall back to the generic paywall, which pitches whatever plan
  // still is (Vettri and Premium also unlock mocks).
  const sales = usePlanSales()
  const mockPurchase = useMockPackPurchase()

  const [exams, setExams] = useState<MockExam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .mockExams()
      .then((r) => !cancelled && setExams(r.exams))
      .catch(() => !cancelled && setError(t('couldNotLoad')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const launch = (e: MockExam) => {
    const config: QuizConfig = {
      category: 'pyq', // grading is category-agnostic; the engine uses the fetched rows
      proctored: true,
      mock: true,
      mockKind: 'exam',
      mockExamId: e.id,
      mockQuestionCount: e.total_questions,
      mockDurationSeconds: e.duration_seconds,
      negativeMark: e.negative_mark,
      label: `${t('mockTest')} · ${lang === 'ta' && e.title_ta ? e.title_ta : e.title}`,
    }
    navigate('/mock/instructions', { state: config })
  }

  /**
   * What a learner would see for this exam. In preview the free tier is the
   * honest default: an admin has no student entitlement to reflect, and showing
   * the paywall is the whole point of the toggle.
   */
  const lockedFor = (e: MockExam) => (previewAsStudent ? e.tier === 'paid' : e.locked)

  const anyLocked = exams.some(lockedFor)

  /** What a tap on a locked exam should do — never nothing. */
  const offerAccess = () => {
    if (sales.mockPack && !mockPurchase.mockPackUnlocked) return mockPurchase.startEnroll()
    upsell.bundle()
  }

  return (
    <div className="animate-fadeIn">
      <p className="tamil mb-6 text-center font-body text-sm text-ink2">{t('mockFullSub')}</p>

      {loading && <SkeletonCards count={4} height="h-28" />}

      {!loading && error && <p className="text-center font-body text-sm text-wrong">{error}</p>}

      {!loading && !error && exams.length === 0 && (
        <p className="tamil text-center font-body text-sm text-ink2">{t('mockExamsEmpty')}</p>
      )}

      {!loading && !error && exams.length > 0 && (
        <div className="space-y-3">
          {exams.map((e) => {
            const title = lang === 'ta' && e.title_ta ? e.title_ta : e.title
            const minutes = Math.round(e.duration_seconds / 60)
            const exhausted = e.attemptsUsed >= e.attemptsMax
            const locked = lockedFor(e)
            const disabled = locked || exhausted
            return (
              <div
                key={e.id}
                className={[
                  'rounded-card border border-line bg-card p-4 sm:p-5',
                  disabled ? 'opacity-80' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="tamil truncate font-heading text-base font-semibold text-ink">
                        {title}
                      </h3>
                      {locked && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accentwarmsoft px-2 py-0.5 font-heading text-2xs font-semibold text-accentwarm">
                          <Lock size={11} /> {t('premiumOnly')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Tag>
                        <FileText size={12} /> {e.total_questions} Q
                      </Tag>
                      <Tag>
                        <Clock size={12} /> {minutes} {t('minutesUnit')}
                      </Tag>
                      <span className="inline-flex items-center gap-1 font-body text-2xs text-ink2">
                        {exhausted ? (
                          <>
                            <CheckCircle2 size={12} className="text-correct" /> {t('examCompleted')}
                          </>
                        ) : (
                          `${t('attemptWord')} ${e.attemptsUsed}/${e.attemptsMax}`
                        )}
                      </span>
                    </div>
                  </div>
                  {/* A locked (premium-only) exam stays tappable: the tap opens
                      the forced upsell instead of silently doing nothing. Only
                      the attempt-cap state is a true dead end. */}
                  <button
                    onClick={() => (locked ? offerAccess() : !disabled && launch(e))}
                    disabled={exhausted}
                    className="btn-brand shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {exhausted ? t('examCompleted') : t('startExam')}
                  </button>
                </div>
                {locked && (
                  <p className="tamil mt-3 border-t border-line pt-3 font-body text-xs text-ink2">
                    {t('examLocked')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* When at least one exam is paywalled, surface the way to unlock it. The
          ₹399 pack leads because it is the plan that sells these exact papers;
          the Premium card sits under it and hides itself when Premium is off
          sale or already owned. */}
      {!loading && anyLocked && (
        <div className="mt-6 space-y-4">
          {sales.mockPack && !mockPurchase.mockPackUnlocked && (
            <button
              onClick={() => mockPurchase.startEnroll()}
              disabled={mockPurchase.paying}
              className="flex w-full items-center gap-3 rounded-card bg-sky px-4 py-3 text-left text-white transition hover:brightness-105 disabled:opacity-60"
            >
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
                <ListChecks size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="tamil block font-display text-sm font-bold tracking-tight">
                  {t('mockPackBannerTitle')}
                </span>
                <span className="tamil mt-0.5 block font-body text-xs text-white/85">
                  {t('mockPackBannerSub')}
                </span>
              </span>
              <span className="flex flex-shrink-0 flex-col items-end rounded-pill bg-white/15 px-3 py-1.5">
                <span className="font-heading text-sm font-bold">₹{MOCK_PACK_PRICE_RUPEES}</span>
              </span>
            </button>
          )}
          <PremiumCard />
        </div>
      )}

      {/* Pre-payment recap for both entry points above (the banner and a tap on
          a locked exam). Opens Razorpay only once the buyer confirms. */}
      <PurchaseConfirmModal
        open={mockPurchase.confirmOpen}
        planName={t('mockPackBannerTitle')}
        validity={t('mockPackValidity')}
        perks={[t('mockPackBannerSub'), t('mockPackPerkPyq'), t('mockPackPerk2'), t('mockPackPerk3')]}
        priceLabel={mockPurchase.isFree ? t('premiumFree') : mockPurchase.displayPrice}
        isFree={mockPurchase.isFree}
        accent="sky"
        busy={mockPurchase.paying}
        onConfirm={mockPurchase.handleBuy}
        onCancel={() => mockPurchase.setConfirmOpen(false)}
      />
    </div>
  )
}

/** Small metadata pill (question count, duration). Exported because
 *  MockTestPage's group-exam tab uses it too, and this file is now the one
 *  place it is defined — importing it back the other way would make the page
 *  and this component import each other. */
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-tint px-2.5 py-1 font-heading text-2xs font-medium uppercase tracking-wide text-ink2">
      {children}
    </span>
  )
}
