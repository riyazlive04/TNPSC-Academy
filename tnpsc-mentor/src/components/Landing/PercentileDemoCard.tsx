import { useEffect, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'

/** Sample progression the State Level Analytics demo card cycles through -
 * illustrative numbers (not a live query), captioned as an example by the
 * copy the calling page puts next to it. */
const PERCENTILE_STAGES = [
  { percentile: 25, tests: '1' },
  { percentile: 20, tests: '5' },
  { percentile: 15, tests: '15+' },
] as const

const RANK_DEMO_HOLD_MS = 2100
const RANK_DEMO_TRANSITION_S = 0.7
const RANK_DEMO_RESET_FADE_MS = 350

// Bar-chart scale: the three milestones (Top 25/20/15%) only span a 20-point
// range, so a literal 0-100 scale would make every bar look nearly the same
// height. Zooming the axis to 70-90 (with a small non-zero baseline for
// "not reached yet" bars) keeps the chart honestly ordered while making the
// improvement visually legible - a normal charting convention for tightly
// clustered values, not a distortion of what the numbers mean.
const BAR_SCALE_MIN = 70
const BAR_SCALE_MAX = 90
const BAR_BASELINE_PCT = 12
const scaleBarHeight = (value: number) => {
  const clamped = Math.min(Math.max(value, BAR_SCALE_MIN), BAR_SCALE_MAX)
  const t = (clamped - BAR_SCALE_MIN) / (BAR_SCALE_MAX - BAR_SCALE_MIN)
  return BAR_BASELINE_PCT + t * (100 - BAR_BASELINE_PCT)
}

/**
 * Looping ~6.5s demo of the State Level Analytics card: the percentile counts
 * down smoothly (via a Framer Motion value, so it's driven by rAF - genuinely
 * 60fps, not a CSS keyframe approximation) as "Tests taken" advances, pulses on
 * each new stage, then fades out/in to reset. Deliberately ignores
 * prefers-reduced-motion (unlike Reveal): it's a small, self-contained
 * illustrative loop rather than page-scroll motion, and the whole point of this
 * card is to show the feature in action.
 *
 * Shared by every public test-series landing page, all of which make the same
 * "see where you stand after every test" pitch about the same real feature
 * (GET /api/profile/percentile, shown on ResultPage and InsightsPage).
 */
export default function PercentileDemoCard({
  label,
  chartCaption,
}: {
  label: string
  chartCaption: string
}) {
  const [stage, setStage] = useState(0)
  const [resetting, setResetting] = useState(false)
  const count = useMotionValue<number>(PERCENTILE_STAGES[0].percentile)
  const [display, setDisplay] = useState<number>(PERCENTILE_STAGES[0].percentile)

  useEffect(() => {
    const unsub = count.on('change', (v) => setDisplay(Math.round(v)))
    return unsub
  }, [count])

  useEffect(() => {
    let cancelled = false
    let index = 0
    let timer: ReturnType<typeof setTimeout>

    const holdThenAdvance = () => {
      timer = setTimeout(() => {
        if (cancelled) return
        if (index + 1 < PERCENTILE_STAGES.length) {
          index += 1
          setStage(index)
          animate(count, PERCENTILE_STAGES[index].percentile, {
            duration: RANK_DEMO_TRANSITION_S,
            ease: 'easeInOut',
          })
          holdThenAdvance()
        } else {
          // Seamless loop reset - fade out, snap back to stage 0, fade in,
          // rather than visibly counting back up (which would read as the
          // rank getting worse).
          setResetting(true)
          timer = setTimeout(() => {
            if (cancelled) return
            index = 0
            count.set(PERCENTILE_STAGES[0].percentile)
            setStage(0)
            setResetting(false)
            holdThenAdvance()
          }, RANK_DEMO_RESET_FADE_MS)
        }
      }, RANK_DEMO_HOLD_MS)
    }

    holdThenAdvance()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [count])

  const current = PERCENTILE_STAGES[stage]

  return (
    <motion.div
      className="rounded-field bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-lg shadow-brand/30"
      animate={{ opacity: resetting ? 0 : 1 }}
      transition={{ duration: RANK_DEMO_RESET_FADE_MS / 1000, ease: 'easeInOut' }}
    >
      <p className="tamil font-heading text-xs font-semibold uppercase tracking-wide text-white/70">{label}</p>
      <motion.p
        key={stage}
        className="mt-2 font-display text-4xl font-bold tracking-tight"
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        Top {display}%
      </motion.p>
      <AnimatePresence mode="wait">
        <motion.p
          key={current.tests}
          className="mt-1.5 font-body text-2xs text-white/60"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
        >
          Tests taken: {current.tests}
        </motion.p>
      </AnimatePresence>

      {/* Progress bar chart - this ONE learner's own percentile at each
          milestone (1 / 5 / 15+ tests taken), never a comparison against
          named other students (the app itself only ever shows an anonymous
          aggregate percentile). Bars for milestones already reached stay
          filled; the active milestone's bar grows live with the same count
          driving the big number above; future milestones sit at a low
          baseline until their turn. */}
      <div className="mt-4 flex items-end justify-between gap-3">
        {PERCENTILE_STAGES.map((s, i) => {
          const reached = i <= stage
          const liveValue = i === stage ? 100 - display : 100 - s.percentile
          const heightPct = reached ? scaleBarHeight(liveValue) : BAR_BASELINE_PCT
          return (
            <div key={s.tests} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`font-body text-[10px] font-semibold transition-colors duration-300 ${
                  reached ? 'text-white' : 'text-white/30'
                }`}
              >
                Top {s.percentile}%
              </span>
              <div className="relative h-14 w-full overflow-hidden rounded-md bg-white/10">
                <motion.div
                  className={`absolute bottom-0 left-0 w-full rounded-t-md ${
                    reached ? 'bg-accentwarm' : 'bg-white/20'
                  }`}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: RANK_DEMO_TRANSITION_S, ease: 'easeInOut' }}
                />
              </div>
              <span className="font-body text-[10px] text-white/50">{s.tests}</span>
            </div>
          )
        })}
      </div>
      <p className="tamil mt-1.5 text-center font-body text-[10px] text-white/40">{chartCaption}</p>
    </motion.div>
  )
}
