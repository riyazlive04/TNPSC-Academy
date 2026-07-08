import { ArrowRight, Sparkles } from 'lucide-react'
import { STARTER_TEST_QUESTIONS, FIRST_TEST_BONUS } from '../../lib/starterTest'
import { useT } from '../../lib/i18n'

/**
 * First-login prompt: before anything else (including the guided tour), a
 * freshly created account is invited to take the Starter Challenge. Starting
 * the test or skipping both consume the prompt; the tour then runs when the
 * user is next on the dashboard (straight away on skip, or after the test).
 * Deliberately NOT dismissable by backdrop/Escape - the two buttons are the
 * only exits, so the sequence always advances.
 */
export default function StarterTestPrompt({
  onStart,
  onSkip,
}: {
  /** Launch the Starter Challenge (the caller consumes the prompt first). */
  onStart: () => void
  /** Skip for now - the guided tour takes over immediately. */
  onSkip: () => void
}) {
  const { t } = useT()

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-[2px] animate-fadeInFast"
      role="dialog"
      aria-modal="true"
      aria-label={t('starterTestLabel')}
    >
      <div className="w-full max-w-sm animate-sheetIn rounded-3xl border border-line bg-card p-6 text-center shadow-card">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-tint-violet text-primary">
          <Sparkles size={26} />
        </span>

        <p className="tamil mt-4 font-heading text-[11px] font-bold uppercase tracking-wide text-primary">
          {t('firstTestBadge')}
        </p>
        <h2 className="tamil mt-1.5 font-display text-xl font-bold leading-tight tracking-tight text-ink">
          {t('onbFirstTestTitle')}
        </h2>
        <p className="tamil mt-2 font-body text-sm leading-relaxed text-muted">
          {t('onbFirstTestBody')}
        </p>

        {/* Quick facts strip - size + bonus, mirroring the dashboard hero. */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="rounded-full bg-tint px-3 py-1 font-heading text-[11px] font-semibold text-ink2">
            {STARTER_TEST_QUESTIONS} {t('questionsCount')}
          </span>
          <span className="rounded-full bg-goldsoft px-3 py-1 font-heading text-[11px] font-semibold text-gold">
            +{FIRST_TEST_BONUS} {t('creditsWord')}
          </span>
        </div>

        <div className="mt-5 space-y-2">
          <button onClick={onStart} className="btn-brand w-full py-2.5 text-sm">
            {t('onbFirstTestCta')} <ArrowRight size={16} />
          </button>
          <button onClick={onSkip} className="btn-ghost w-full py-2 text-sm">
            {t('startPromptSkip')}
          </button>
        </div>
      </div>
    </div>
  )
}
