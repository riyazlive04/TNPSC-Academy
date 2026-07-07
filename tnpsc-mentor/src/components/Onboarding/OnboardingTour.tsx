import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Sparkles, Compass, X } from 'lucide-react'
import { useT, type StringKey } from '../../lib/i18n'

/**
 * First-run GUIDED tour - shown only to freshly created accounts. Rather than a
 * passive slideshow, it dims the real dashboard and spotlights the actual
 * controls one at a time (the mock-test hero, the practice list, the
 * revision/insights links, the language toggle), pointing the new aspirant at
 * what to tap. Steps that target a real element are anchored to it via a
 * `data-tour="<id>"` attribute; steps with no target render as a centred card
 * (welcome / finish). The final step ends in ACTION: its primary button launches
 * the Starter Challenge (via onStartTest), with a quiet "explore on my own"
 * escape underneath — new accounts should leave the tour inside a test, not on
 * an empty dashboard. Fully bilingual via useT(). Robust by design: if a target
 * can't be found it degrades to a centred card instead of breaking.
 */

interface Step {
  /** `data-tour` id of the element to spotlight; omit for a centred card. */
  target?: string
  titleKey: StringKey
  bodyKey: StringKey
}

const STEPS: Step[] = [
  { titleKey: 'onbWelcomeTitle', bodyKey: 'onbWelcomeBody' },
  { target: 'mock', titleKey: 'onbMockTitle', bodyKey: 'onbMockBody' },
  { target: 'practice', titleKey: 'onbPracticeTitle', bodyKey: 'onbPracticeBody' },
  { target: 'credits', titleKey: 'onbCreditsTitle', bodyKey: 'onbCreditsBody' },
  { target: 'progress', titleKey: 'onbProgressTitle', bodyKey: 'onbProgressBody' },
  { target: 'lang', titleKey: 'onbLangTitle', bodyKey: 'onbLangBody' },
  { titleKey: 'onbFirstTestTitle', bodyKey: 'onbFirstTestBody' },
]

/** Padding (px) around the spotlit element, and gap between it and the tooltip. */
const PAD = 8
const GAP = 14
const CARD_W = 340

export default function OnboardingTour({
  open,
  onFinish,
  onStartTest,
}: {
  open: boolean
  /** Called when the tour completes, is skipped, or the user starts a mock. */
  onFinish: () => void
  /** Launches the Starter Challenge from the final step (tour closes first). */
  onStartTest?: () => void
}) {
  const { t } = useT()
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  // Resolve the current step's target, scroll it into view, and measure it.
  // Re-measured on resize/scroll so the spotlight tracks the element. A missing
  // target (or a no-target step) clears the rect → centred card.
  const measure = useCallback(() => {
    const el = targetRef.current
    if (!el) return setRect(null)
    setRect(el.getBoundingClientRect())
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    if (!current.target) {
      targetRef.current = null
      setRect(null)
      return
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`)
    targetRef.current = el
    if (!el) {
      setRect(null)
      return
    }
    // Instant (not smooth) so the first measurement is correct, not mid-animation.
    el.scrollIntoView({ block: 'center', behavior: 'auto' })
    // Measure next frame, after the scroll has applied.
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
  }, [open, step, current.target, measure])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  // Restart at the first step whenever the tour (re)opens.
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Escape steps backwards, then finishes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setStep((s) => {
        if (s > 0) return s - 1
        onFinish()
        return s
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onFinish])

  if (!open) return null

  const next = () => (isLast ? onFinish() : setStep((s) => s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  return (
    <div className="fixed inset-0 z-[70] animate-fadeInFast" role="dialog" aria-modal="true" aria-label={t('howItWorks')}>
      {/* Click-blocker - swallows page interaction so the tour drives the flow. */}
      <div className="absolute inset-0" />

      {/* Spotlight: a transparent box at the target with a huge outer shadow that
          dims everything else, plus a brand ring. Centred steps (no rect) just
          dim the whole screen. pointer-events-none so it never traps clicks. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white/90 transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(15, 12, 30, 0.72)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-ink/70 backdrop-blur-[2px]" />
      )}

      <TourCard
        rect={rect}
        onClose={onFinish}
        step={step}
        total={STEPS.length}
        onDot={setStep}
        header={
          <span className="font-heading text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
            {step + 1} <span className="text-muted/60">{t('onbStepOf')}</span> {STEPS.length}
          </span>
        }
        skipLabel={t('onbSkip')}
      >
        <div className="mb-1 flex items-center gap-2">
          {isFirst && <Sparkles size={18} className="text-primary" />}
          {isLast && <Compass size={18} className="text-primary" />}
          <h2 className="tamil font-display text-[18px] font-bold leading-tight tracking-tight text-ink">
            {t(current.titleKey)}
          </h2>
        </div>
        <p className="tamil font-body text-[14px] leading-relaxed text-muted">{t(current.bodyKey)}</p>

        {/* Footer nav. The last step ends in action: the primary button hands
            the new aspirant straight to the Starter Challenge; a quiet ghost
            row underneath lets them explore the dashboard instead. */}
        {isLast && onStartTest ? (
          <div className="mt-5 space-y-2">
            <button
              onClick={() => {
                onFinish()
                onStartTest()
              }}
              className="btn-brand w-full py-2.5 text-sm"
            >
              {t('onbFirstTestCta')} <ArrowRight size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <button onClick={back} className="btn-ghost flex-shrink-0 px-3.5 py-2 text-sm" aria-label={t('back')}>
                <ArrowLeft size={16} />
              </button>
              <button onClick={onFinish} className="btn-ghost flex-1 py-2 text-sm">
                {t('onbStartExploring')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-2.5">
            {!isFirst && (
              <button onClick={back} className="btn-ghost flex-shrink-0 px-3.5 py-2 text-sm" aria-label={t('back')}>
                <ArrowLeft size={16} />
              </button>
            )}
            <button onClick={next} className="btn-brand flex-1 py-2.5 text-sm">
              {isLast ? t('onbStartExploring') : t('onbNext')} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </TourCard>
    </div>
  )
}

/**
 * The floating tooltip card. Anchored just below the spotlit element (or above,
 * when there isn't room below); centred in the viewport for target-less steps.
 * Position is computed from the target rect and clamped to stay on-screen.
 */
function TourCard({
  rect,
  step,
  total,
  onDot,
  onClose,
  header,
  skipLabel,
  children,
}: {
  rect: DOMRect | null
  step: number
  total: number
  onDot: (i: number) => void
  onClose: () => void
  header: React.ReactNode
  skipLabel: string
  children: React.ReactNode
}) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640
  const width = Math.min(CARD_W, vw - 24)

  let style: React.CSSProperties
  if (!rect) {
    // Centred card.
    style = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width }
  } else {
    const centerX = rect.left + rect.width / 2
    const left = Math.max(12, Math.min(centerX - width / 2, vw - width - 12))
    const below = rect.bottom + GAP
    const placeBelow = below + 230 < vh || rect.top < 230
    style = placeBelow
      ? { left, top: below, width }
      : { left, bottom: vh - rect.top + GAP, width }
  }

  return (
    <div
      className="absolute rounded-3xl border border-line bg-card p-5 shadow-card animate-sheetIn"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2.5 flex items-center justify-between">
        {header}
        <button
          onClick={onClose}
          className="focus-ring -mr-1 inline-flex items-center gap-1 rounded-full px-2 py-1 font-heading text-[12px] font-semibold text-muted hover:bg-tint-coral hover:text-accent"
        >
          {skipLabel} <X size={14} />
        </button>
      </div>

      {children}

      {/* Progress dots */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => onDot(i)}
            aria-label={`${i + 1} / ${total}`}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-5 bg-primary' : 'w-1.5 bg-line hover:bg-primary/40'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
