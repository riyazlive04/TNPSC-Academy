import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useT, type StringKey } from '../lib/i18n'
import { useOnboardingStore } from '../store/onboardingStore'
import { DURATION, EASE_OUT, EASE_STANDARD, tapScale } from '../lib/motion'
import { setBackInterceptor } from '../lib/backInterceptor'
import type { Tint } from '../components/UI/IconTile'

/**
 * First-run INTRO SCREENS - the full-viewport "what's in the app" walkthrough a
 * new aspirant steps through with Next / Back before ever seeing the dashboard.
 *
 * It answers a different question from <OnboardingTour>: these slides say WHAT
 * the app contains (previous-year papers, subject practice, mock tests, current
 * affairs, revision + insights), while the dashboard tour later points at WHERE
 * to tap. Shown once per account - armed at signup (onboardingStore.arm()),
 * consumed here by the final slide or Skip - and replayable any time from the
 * profile's "What's inside the app" row.
 *
 * Navigation is deliberately three ways over the same state: the Next/Back
 * buttons, a horizontal swipe, and the dots (which jump straight to a slide).
 * Fully bilingual via useT(), and every slide degrades to a plain fade when the
 * OS asks for reduced motion.
 */

interface Slide {
  /** Illustration from public/ - the subject-icon artwork, reused here. */
  icon: string
  tint: Tint
  titleKey: StringKey
  bodyKey: StringKey
  /** Two short "you get this" lines under the copy. */
  points: [StringKey, StringKey]
}

const SLIDES: Slide[] = [
  {
    icon: '/logo-mark.png',
    tint: 'violet',
    titleKey: 'introWelcomeTitle',
    bodyKey: 'introWelcomeBody',
    points: ['introWelcomeP1', 'introWelcomeP2'],
  },
  {
    icon: '/subject-icons/pyq-group-1.png',
    tint: 'blue',
    titleKey: 'introPyqTitle',
    bodyKey: 'introPyqBody',
    points: ['introPyqP1', 'introPyqP2'],
  },
  {
    icon: '/subject-icons/samacheer.png',
    tint: 'green',
    titleKey: 'introPracticeTitle',
    bodyKey: 'introPracticeBody',
    points: ['introPracticeP1', 'introPracticeP2'],
  },
  {
    icon: '/subject-icons/mock-test.png',
    tint: 'coral',
    titleKey: 'introMockTitle',
    bodyKey: 'introMockBody',
    points: ['introMockP1', 'introMockP2'],
  },
  {
    icon: '/subject-icons/current-affairs-hub.png',
    tint: 'blue',
    titleKey: 'introCaTitle',
    bodyKey: 'introCaBody',
    points: ['introCaP1', 'introCaP2'],
  },
  {
    icon: '/subject-icons/revision.png',
    tint: 'violet',
    titleKey: 'introProgressTitle',
    bodyKey: 'introProgressBody',
    points: ['introProgressP1', 'introProgressP2'],
  },
]

const TINT_BG: Record<Tint, string> = {
  violet: 'bg-tint-violet',
  coral: 'bg-tint-coral',
  blue: 'bg-tint-blue',
  green: 'bg-tint-green',
}

/** Horizontal drag (px) that counts as a deliberate swipe to the next slide. */
const SWIPE_PX = 60

export default function WelcomeIntroPage() {
  const navigate = useNavigate()
  const { t } = useT()
  const reduce = useReducedMotion()
  const consumeIntro = useOnboardingStore((s) => s.consumeIntro)

  // Was this the real first run, or a replay from the profile? Read once, on
  // mount, BEFORE the flag is consumed - it decides where "done" leads.
  const [firstRun] = useState(() => useOnboardingStore.getState().intro)

  // [index, direction] - direction (+1/-1) drives which way the slides travel.
  const [[step, dir], setStep] = useState<[number, number]>([0, 0])
  const slide = SLIDES[step]
  const isFirst = step === 0
  const isLast = step === SLIDES.length - 1

  const finish = useCallback(() => {
    consumeIntro()
    // First run lands in the app; a replay returns to wherever it was opened
    // (falling back to the app when there is no history to go back to, e.g. the
    // URL was opened directly).
    if (!firstRun && window.history.length > 1) navigate(-1)
    else navigate('/test-arena', { replace: true })
  }, [consumeIntro, firstRun, navigate])

  const goTo = useCallback((i: number) => {
    setStep(([cur]) => [Math.max(0, Math.min(SLIDES.length - 1, i)), i > cur ? 1 : -1])
  }, [])

  const next = useCallback(() => {
    if (isLast) finish()
    else goTo(step + 1)
  }, [isLast, finish, goTo, step])

  const back = useCallback(() => goTo(step - 1), [goTo, step])

  // Android's hardware back walks the slides backwards (like every native
  // onboarding) and only leaves the walkthrough from the first slide, where it
  // falls through to BackButtonGuard's normal handling.
  useEffect(() => {
    return setBackInterceptor(() => {
      if (step === 0) return false
      back()
      return true
    })
  }, [step, back])

  // Keyboard: arrows page through the slides, Escape skips out. (Desktop web -
  // on mobile the same moves are the buttons and the swipe.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, finish])

  // Slide in from the side it was asked for, out to the opposite side. With
  // reduced motion it is a straight cross-fade (no travel at all).
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d >= 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0, transition: { duration: DURATION.standard, ease: EASE_OUT } },
    exit: (d: number) => ({
      opacity: 0,
      x: reduce ? 0 : d >= 0 ? -40 : 40,
      transition: { duration: DURATION.pageOut, ease: EASE_STANDARD },
    }),
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas bg-brand-radial pb-safe pt-safe">
      {/* Skip - always reachable, so the walkthrough is never a wall. */}
      <header className="flex items-center justify-end px-5 pt-4">
        <button
          onClick={finish}
          className="focus-ring rounded-full px-3 py-1.5 font-heading text-sm font-semibold text-muted transition-colors hover:bg-tint/50 hover:text-brand-dark"
        >
          {t('introSkip')}
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-4">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              // Swipe through the slides the way a native intro does. The drag
              // is elastic and snaps back - it only ever *triggers* a step.
              drag={reduce ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x <= -SWIPE_PX) next()
                else if (info.offset.x >= SWIPE_PX && !isFirst) back()
              }}
              className="flex flex-col items-center text-center"
            >
              <div
                className={`mb-7 grid h-40 w-40 place-items-center rounded-hero p-6 shadow-soft ${TINT_BG[slide.tint]}`}
              >
                <img src={slide.icon} alt="" className="h-full w-full object-contain" />
              </div>

              <h1 className="tamil font-display text-2xl font-bold leading-tight tracking-tight text-ink">
                {t(slide.titleKey)}
              </h1>
              <p className="tamil mt-2.5 font-body text-sm leading-relaxed text-muted">
                {t(slide.bodyKey)}
              </p>

              <ul className="mt-6 w-full space-y-2.5 text-left">
                {slide.points.map((key) => (
                  <li key={key} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-tint-violet text-primary">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="tamil font-body text-sm leading-relaxed text-ink2">
                      {t(key)}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="px-5 pb-6">
        <div className="mx-auto w-full max-w-md">
          {/* Progress dots - also a shortcut straight to any slide. */}
          <div className="mb-5 flex items-center justify-center gap-1.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.titleKey}
                onClick={() => goTo(i)}
                aria-label={`${i + 1} / ${SLIDES.length}`}
                aria-current={i === step}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-primary' : 'w-1.5 bg-line hover:bg-primary/40'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Back keeps its slot on the first slide (disabled, not removed) so
                the Next button never jumps sideways between steps. */}
            <motion.button
              whileTap={reduce || isFirst ? undefined : tapScale}
              onClick={back}
              disabled={isFirst}
              aria-label={t('back')}
              className="btn-ghost flex-shrink-0 px-4 py-3 text-sm"
            >
              <ArrowLeft size={16} />
              <span className="tamil hidden sm:inline">{t('back')}</span>
            </motion.button>

            <motion.button
              whileTap={reduce ? undefined : tapScale}
              onClick={next}
              className="btn-wrap btn-brand flex-1 py-3 text-base"
            >
              <span className="tamil">{isLast ? t('onbGetStarted') : t('onbNext')}</span>
              <ArrowRight size={18} />
            </motion.button>
          </div>
        </div>
      </footer>
    </div>
  )
}
