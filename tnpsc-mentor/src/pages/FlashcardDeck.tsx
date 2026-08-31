import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Check, RotateCcw, X } from 'lucide-react'
import { api, type FlashcardCard } from '../lib/api'
import {
  bilingual,
  difficultyLabel,
  studyOrder,
  DIFFICULTY_CLASS,
} from '../lib/flashcards'
import { useSmartBack } from '../hooks/useSmartBack'
import { hapticSelect, hapticSuccess } from '../lib/haptics'
import { toast } from '../store/toastStore'
import { useT } from '../lib/i18n'
import { DURATION, EASE_OUT } from '../lib/motion'
import LogoLoader from '../components/UI/LogoLoader'

/**
 * The full-screen flashcard viewer (a BARE route — it owns the whole viewport,
 * no header or tab bar; see App.tsx).
 *
 * Two gestures, deliberately kept on separate elements so they never fight:
 *   • TAP  → flips the card (rotateY 0 ⇄ 180 with hidden backfaces). Front is
 *            the question + its difficulty tag; back is the answer.
 *   • DRAG x → the verdict. Right = "Knew it", left = "Need to study".
 *
 * Each verdict is a spaced-revision review: right advances the card along the
 * SM-2-lite curve, left resets it so it comes back today. Both land in the same
 * review_items deck as the MCQ revision (see supabase/flashcards.sql).
 *
 * Grading is fire-and-forget — the next card arrives immediately and a failed
 * write surfaces as a toast rather than blocking the run. The deck order is
 * frozen at load (studyOrder), so nothing reshuffles under the learner's thumb.
 */

/** Past this much horizontal travel (or a hard flick) the swipe commits. */
const COMMIT_PX = 90
const COMMIT_VELOCITY = 420

export default function FlashcardDeck() {
  const { deckId } = useParams<{ deckId: string }>()
  const back = useSmartBack()
  const { t, lang } = useT()
  const reduce = useReducedMotion()

  const [cards, setCards] = useState<FlashcardCard[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  // Which way the outgoing card leaves — drives the exit animation.
  const [exitDir, setExitDir] = useState<1 | -1>(1)
  const [tally, setTally] = useState({ knew: 0, study: 0 })

  // Guards a double-commit: a fast flick can fire dragEnd twice before React
  // has re-rendered the next card.
  const committing = useRef(false)

  useEffect(() => {
    if (!deckId) return
    let cancelled = false
    api.flashcards
      .deck(deckId)
      .then((list) => {
        if (cancelled) return
        // Frozen for the whole session: due cards first, then the rest.
        setCards(studyOrder(list))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [deckId])

  const total = cards?.length ?? 0
  const card = cards && index < total ? cards[index] : null
  const done = !!cards && index >= total

  const commit = useCallback(
    (knew: boolean) => {
      if (!card || committing.current) return
      committing.current = true

      if (knew) hapticSuccess()
      else hapticSelect()
      setExitDir(knew ? 1 : -1)
      setTally((s) => (knew ? { ...s, knew: s.knew + 1 } : { ...s, study: s.study + 1 }))

      // Fire-and-forget: the run must not wait on the network.
      api.flashcards.grade(card.id, knew).catch(() => {
        toast.error(t('flashcardSaveFailed'))
      })

      setFlipped(false)
      setIndex((i) => i + 1)
      // Released once the next card has mounted.
      window.setTimeout(() => {
        committing.current = false
      }, 0)
    },
    [card, t]
  )

  // Keyboard parity for the web build: ←/→ verdict, space/enter flips.
  useEffect(() => {
    if (!card) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') commit(true)
      else if (e.key === 'ArrowLeft') commit(false)
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === 'Escape') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, commit, back])

  const restart = () => {
    if (!cards) return
    setIndex(0)
    setFlipped(false)
    setTally({ knew: 0, study: 0 })
  }

  if (!deckId) return null

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/* ─── Top bar: segmented progress + close ─────────────────────────── */}
      <header className="pt-safe px-4 pb-2">
        <div className="flex items-center gap-3 pt-3">
          <ProgressSegments total={total} index={index} />
          <button
            onClick={back}
            aria-label={t('close')}
            className="focus-ring -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted
              transition-colors hover:bg-tint-violet hover:text-primary"
          >
            <X size={20} />
          </button>
        </div>
        {total > 0 && !done && (
          <p className="mt-2 text-center font-body text-2xs text-muted">
            {index + 1} / {total}
          </p>
        )}
      </header>

      {/* ─── Stage ───────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-8">
        {failed ? (
          <EmptyState message={t('flashcardLoadFailed')} onBack={back} backLabel={t('back')} />
        ) : !cards ? (
          <LogoLoader size={56} />
        ) : total === 0 ? (
          <EmptyState message={t('flashcardDeckEmpty')} onBack={back} backLabel={t('back')} />
        ) : done ? (
          <Summary
            knew={tally.knew}
            study={tally.study}
            onRestart={restart}
            onDone={back}
            t={t}
          />
        ) : (
          <>
            <AnimatePresence mode="popLayout" initial={false}>
              <SwipeCard
                key={card!.id}
                card={card!}
                flipped={flipped}
                onFlip={() => {
                  hapticSelect()
                  setFlipped((f) => !f)
                }}
                onCommit={commit}
                exitDir={exitDir}
                reduce={!!reduce}
                lang={lang}
                t={t}
              />
            </AnimatePresence>

            {/* Explicit buttons: the swipe is the native gesture, but the verdict
                must never be reachable ONLY by drag (accessibility, and desktop). */}
            <div className="mt-7 flex w-full max-w-sm items-center justify-center gap-3">
              <VerdictButton
                tone="study"
                label={t('needToStudy')}
                onClick={() => commit(false)}
              />
              <VerdictButton tone="knew" label={t('knewIt')} onClick={() => commit(true)} />
            </div>
            <p className="tamil mt-4 text-center font-body text-2xs text-muted">
              {t('flashcardHint')}
            </p>
          </>
        )}
      </main>
    </div>
  )
}

// ─── The card ───────────────────────────────────────────────────────────────

interface SwipeCardProps {
  card: FlashcardCard
  flipped: boolean
  onFlip: () => void
  onCommit: (knew: boolean) => void
  exitDir: 1 | -1
  reduce: boolean
  lang: ReturnType<typeof useT>['lang']
  t: ReturnType<typeof useT>['t']
}

/**
 * Outer element owns the drag; the inner element owns the flip. Putting both on
 * one node makes framer compose the x-translation into the same transform as
 * the 3D rotation, and the card visibly skews mid-swipe.
 */
function SwipeCard({
  card,
  flipped,
  onFlip,
  onCommit,
  exitDir,
  reduce,
  lang,
  t,
}: SwipeCardProps) {
  const x = useMotionValue(0)
  // A little tilt in the direction of travel, and the two verdict watermarks
  // fading in as the swipe approaches its commit point.
  const rotate = useTransform(x, [-220, 0, 220], [-9, 0, 9])
  const knewOpacity = useTransform(x, [30, COMMIT_PX], [0, 1])
  const studyOpacity = useTransform(x, [-COMMIT_PX, -30], [1, 0])

  const question = bilingual(card.question_en, card.question_ta, lang)
  const answer = bilingual(card.answer_en, card.answer_ta, lang)

  return (
    <motion.div
      className="w-full max-w-sm cursor-grab active:cursor-grabbing"
      style={{ x, rotate, perspective: 1200 }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.18}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        const { offset, velocity } = info
        if (offset.x > COMMIT_PX || velocity.x > COMMIT_VELOCITY) onCommit(true)
        else if (offset.x < -COMMIT_PX || velocity.x < -COMMIT_VELOCITY) onCommit(false)
      }}
      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={
        reduce
          ? { opacity: 0 }
          : {
              x: exitDir * 520,
              opacity: 0,
              rotate: exitDir * 14,
              transition: { duration: DURATION.standard, ease: EASE_OUT },
            }
      }
      transition={{ duration: DURATION.standard, ease: EASE_OUT }}
    >
      {/* The flipping body. Height is fixed so the two faces — which are stacked
          absolutely — always agree, and the layout doesn't jump on flip. */}
      <motion.div
        role="button"
        tabIndex={0}
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onFlip()
          }
        }}
        aria-label={flipped ? t('showQuestion') : t('showAnswer')}
        className="focus-ring relative h-[22rem] w-full select-none sm:h-[24rem]"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={
          reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
        }
      >
        {/* ── Front: question + difficulty tag ── */}
        <CardFace>
          <span
            className={`self-start rounded-pill px-2.5 py-1 font-heading text-2xs font-bold uppercase
              tracking-wide ${DIFFICULTY_CLASS[card.difficulty]}`}
          >
            {difficultyLabel(card.difficulty, lang)}
          </span>
          <div className="flex flex-1 items-center">
            <div className="w-full space-y-2">
              {question.map((line, i) => (
                <p
                  key={i}
                  className="tamil text-center font-display text-lg font-semibold leading-snug text-ink"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
          <span className="tamil text-center font-body text-2xs text-muted">
            {t('tapToReveal')}
          </span>
        </CardFace>

        {/* ── Back: the answer. Pre-rotated so it reads correctly once the
               parent has turned 180°. ── */}
        <CardFace back>
          <span className="self-start rounded-pill bg-tint-violet px-2.5 py-1 font-heading text-2xs font-bold uppercase tracking-wide text-primary">
            {t('answer')}
          </span>
          <div className="flex flex-1 items-center">
            <div className="w-full space-y-2">
              {answer.map((line, i) => (
                <p
                  key={i}
                  className="tamil text-center font-display text-xl font-bold leading-snug text-ink"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
          <span className="tamil text-center font-body text-2xs text-muted">
            {t('tapToReveal')}
          </span>
        </CardFace>

        {/* ── Swipe watermarks. Outside the faces so they stay upright and
               readable whichever side is showing. ── */}
        <motion.span
          style={{ opacity: knewOpacity }}
          className="pointer-events-none absolute right-4 top-4 z-10 rounded-pill border-2 border-correct
            px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-correct"
        >
          {t('knewIt')}
        </motion.span>
        <motion.span
          style={{ opacity: studyOpacity }}
          className="pointer-events-none absolute left-4 top-4 z-10 rounded-pill border-2 border-wrong
            px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-wrong"
        >
          {t('needToStudy')}
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

/** One face of the card. Both are absolutely stacked; backfaces are hidden so
 *  only the side facing the viewer paints. */
function CardFace({ children, back = false }: { children: React.ReactNode; back?: boolean }) {
  return (
    <div
      className="absolute inset-0 flex flex-col gap-4 rounded-hero border border-line bg-card p-6 shadow-soft"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: back ? 'rotateY(180deg)' : undefined,
      }}
    >
      {children}
    </div>
  )
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

/** Instagram-style segmented progress: one bar per card, filled as you go. */
function ProgressSegments({ total, index }: { total: number; index: number }) {
  // Above this a per-card segment is a sub-pixel sliver; a single bar reads
  // better and still says exactly where you are.
  if (total > 40) {
    return (
      <div className="h-1 flex-1 overflow-hidden rounded-pill bg-line">
        <div
          className="h-full rounded-pill bg-primary transition-[width] duration-300"
          style={{ width: `${total ? (index / total) * 100 : 0}%` }}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-1 items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-pill transition-colors duration-300 ${
            i < index ? 'bg-primary' : 'bg-line'
          }`}
        />
      ))}
    </div>
  )
}

function VerdictButton({
  tone,
  label,
  onClick,
}: {
  tone: 'knew' | 'study'
  label: string
  onClick: () => void
}) {
  const knew = tone === 'knew'
  return (
    <button
      onClick={onClick}
      className={`focus-ring tamil flex flex-1 items-center justify-center gap-2 rounded-pill border-2
        px-4 py-3 font-heading text-sm font-semibold transition-colors ${
          knew
            ? 'border-correct/40 text-correct hover:bg-correct/10'
            : 'border-wrong/40 text-wrong hover:bg-wrong/10'
        }`}
    >
      {knew ? <Check size={16} /> : <RotateCcw size={16} />}
      {label}
    </button>
  )
}

function Summary({
  knew,
  study,
  onRestart,
  onDone,
  t,
}: {
  knew: number
  study: number
  onRestart: () => void
  onDone: () => void
  t: ReturnType<typeof useT>['t']
}) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-hero bg-tint-green">
        <Check size={30} className="text-correct" />
      </span>
      <div>
        <h1 className="tamil font-display text-2xl font-bold tracking-tight text-ink">
          {t('deckComplete')}
        </h1>
        <p className="tamil mt-2 font-body text-sm leading-relaxed text-muted">
          {t('deckCompleteSub')}
        </p>
      </div>
      <div className="flex w-full gap-3">
        <Stat value={knew} label={t('knewIt')} tone="correct" />
        <Stat value={study} label={t('needToStudy')} tone="wrong" />
      </div>
      <div className="flex w-full flex-col gap-2">
        <button onClick={onRestart} className="btn-brand w-full px-6 py-3 text-sm">
          <RotateCcw size={16} /> {t('studyAgain')}
        </button>
        <button
          onClick={onDone}
          className="focus-ring tamil w-full rounded-pill px-6 py-3 font-heading text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          {t('done')}
        </button>
      </div>
    </div>
  )
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'correct' | 'wrong' }) {
  return (
    <div className="flex-1 rounded-card border border-line bg-card p-4">
      <p className={`font-display text-2xl font-bold ${tone === 'correct' ? 'text-correct' : 'text-wrong'}`}>
        {value}
      </p>
      <p className="tamil mt-0.5 font-body text-2xs text-muted">{label}</p>
    </div>
  )
}

function EmptyState({
  message,
  onBack,
  backLabel,
}: {
  message: string
  onBack: () => void
  backLabel: string
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="tamil max-w-xs font-body text-sm leading-relaxed text-muted">{message}</p>
      <button onClick={onBack} className="btn-brand px-6 py-3 text-sm">
        {backLabel}
      </button>
    </div>
  )
}
