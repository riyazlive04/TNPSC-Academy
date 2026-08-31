import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, Layers, X } from 'lucide-react'
import { api, type FlashcardDeck } from '../../lib/api'
import { deckTeaser, deckTitle } from '../../lib/flashcards'
import { iconFor } from '../../lib/subjectIcons'
import { hapticSelect } from '../../lib/haptics'
import { DURATION, EASE_OUT, tapScale } from '../../lib/motion'
import { useT } from '../../lib/i18n'

/**
 * The flashcard entry point: a card that sits half off the right edge of the
 * screen, around the lower-middle, and slides out into a deck list when tapped.
 *
 * Collapsed it is deliberately clipped by the viewport — only the left sliver
 * shows — which is what reads as "there's something over here" without spending
 * any dashboard space. Tapping opens a panel of every live deck; picking one
 * hands the whole screen to the viewer (/flashcards/:deckId).
 *
 * Mounted by the dashboard only, so it can't collide with the tab bar on other
 * screens — but rendered through a PORTAL to document.body, because the route
 * wrapper in App.tsx animates `y` and a transformed ancestor makes
 * `position: fixed` resolve against that ancestor instead of the viewport. In
 * the tree it would hang off the page's y-offset rather than the screen edge.
 *
 * Renders nothing until at least one deck is live.
 */

// Module-level cache so bouncing off the dashboard and back doesn't re-flash it.
let cache: FlashcardDeck[] | null = null

/** How much of the collapsed card hangs off the right edge, in px. */
const HIDDEN_PX = 64
const CARD_W = 120
/**
 * Counter-clockwise lean on the collapsed card, in degrees. Negative tilts the
 * top toward the right — the "tossed card resting against the edge" look.
 * It straightens to 0 when the panel opens, so the list is never read on a
 * slant.
 */
const TILT = -10

export default function FlashcardPeek() {
  const navigate = useNavigate()
  const { t, lang } = useT()
  const reduce = useReducedMotion()
  const [decks, setDecks] = useState<FlashcardDeck[] | null>(cache)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.flashcards
      .decks()
      .then((list) => {
        cache = list
        if (!cancelled) setDecks(list)
      })
      .catch(() => {
        // Purely additive dashboard affordance — fail silently rather than
        // erroring the home screen over it.
        if (!cancelled) setDecks([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Esc closes the panel, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const live = decks?.filter((d) => d.card_count > 0) ?? []
  if (!live.length) return null

  // The peek advertises the deck with the most waiting, so the sliver is always
  // showing the most useful thing rather than whatever sorted first.
  const lead = [...live].sort((a, b) => b.due_count - a.due_count)[0]
  const totalDue = live.reduce((n, d) => n + d.due_count, 0)
  const leadIcon = iconFor(lead.icon_slug ?? lead.subject)

  const openDeck = (deck: FlashcardDeck) => {
    hapticSelect()
    setOpen(false)
    navigate(`/flashcards/${deck.id}`)
  }

  return createPortal(
    <>
      {/* ─── Collapsed: the sliver hanging off the right edge ──────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="peek"
            onClick={() => {
              hapticSelect()
              setOpen(true)
            }}
            aria-label={`${t('flashcardsTitle')} — ${totalDue} ${t('cardsToStudy')}`}
            // The centring and the tilt BOTH live here, not as Tailwind
            // `-translate-y-1/2` / `rotate-*` classes: motion writes the
            // element's `transform` wholesale, so any transform utility
            // alongside it is silently dropped — the card would sit flat and
            // hang off its top edge instead of tilted and centred.
            initial={reduce ? false : { opacity: 0, x: CARD_W, y: '-50%', rotate: TILT }}
            animate={{ opacity: 1, x: HIDDEN_PX, y: '-50%', rotate: TILT }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: CARD_W, y: '-50%', rotate: TILT }}
            whileTap={reduce ? undefined : tapScale}
            transition={{ duration: DURATION.standard, ease: EASE_OUT }}
            style={{ width: CARD_W }}
            className="focus-ring fixed right-0 top-[58%] z-30 h-[136px]
              overflow-hidden rounded-[26px] bg-brand-gradient shadow-hero"
          >
            {/* Everything worth seeing is packed into the left sliver, because
                the rest of the card is past the edge of the screen. On the
                brand gradient the content goes white — the same treatment the
                gradient gets everywhere else in the app (hero tiles, CTAs). */}
            <span
              className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-1.5"
              style={{ width: CARD_W - HIDDEN_PX }}
            >
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-white ring-2 ring-white/70">
                {leadIcon ? (
                  <img src={leadIcon} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Layers size={20} className="text-primary" />
                )}
              </span>
              {totalDue > 0 && (
                <span className="rounded-pill bg-white/20 px-1.5 py-0.5 font-heading text-[9px] font-bold text-white">
                  {totalDue}
                </span>
              )}
              <ChevronLeft size={14} className="text-white/80" aria-hidden />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Expanded: the deck list ───────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.micro }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40"
            />
            <motion.div
              key="panel"
              role="dialog"
              aria-label={t('flashcardsTitle')}
              // Same reason as the collapsed card: centring must be a motion
              // value, or the panel anchors by its top and runs off the bottom
              // of the screen once it has more than about four decks in it.
              initial={reduce ? false : { opacity: 0, x: 40, y: '-50%' }}
              animate={{ opacity: 1, x: 0, y: '-50%' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, y: '-50%' }}
              transition={{ duration: DURATION.standard, ease: EASE_OUT }}
              className="fixed right-0 top-[58%] z-50 max-h-[70vh] w-[268px]
                overflow-y-auto rounded-l-[26px] border border-r-0 border-line bg-card p-3 shadow-hero"
            >
              <div className="mb-2 flex items-center justify-between pl-1">
                <span className="tamil font-heading text-sm font-bold text-ink">
                  {t('flashcardsTitle')}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t('close')}
                  className="focus-ring grid h-7 w-7 place-items-center rounded-full text-muted
                    transition-colors hover:bg-tint-violet hover:text-primary"
                >
                  <X size={16} />
                </button>
              </div>

              <ul className="space-y-1">
                {live.map((deck) => {
                  const src = iconFor(deck.icon_slug ?? deck.subject)
                  const teaser = deckTeaser(deck, lang)
                  return (
                    <li key={deck.id}>
                      <button
                        onClick={() => openDeck(deck)}
                        className="focus-ring flex w-full items-center gap-2.5 rounded-2xl p-2 text-left
                          transition-colors hover:bg-tint-violet"
                      >
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full
                            bg-tint-violet ring-2 ${
                              deck.due_count > 0 ? 'ring-violet-500' : 'ring-line'
                            }`}
                        >
                          {src ? (
                            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <Layers size={18} className="text-primary" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="tamil block truncate font-heading text-xs font-semibold text-ink">
                            {deckTitle(deck, lang)}
                          </span>
                          {teaser && (
                            <span className="tamil block truncate font-body text-[10px] text-muted">
                              {teaser}
                            </span>
                          )}
                        </span>
                        {deck.due_count > 0 && (
                          <span className="shrink-0 rounded-pill bg-primary px-1.5 py-0.5 font-heading text-[9px] font-bold text-white">
                            {deck.due_count}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}
