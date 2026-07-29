// ─── Motion tokens ──────────────────────────────────────────────────────────
// The single source of truth for animation timing across the app. Everything
// that moves - route transitions, list entrances, press feedback, reveals -
// pulls its duration/easing from here so motion feels like one system, not a
// pile of ad-hoc timings. (design-system.md "Make it feel like an app".)
//
// Durations are in SECONDS (the unit `motion/react` expects).

export const DURATION = {
  /** Micro feedback: press, hover, toggle. */
  micro: 0.15,
  /** Standard: state changes, reveals, entrances. */
  standard: 0.25,
  /** A screen arriving. Keep it short — the shell stays put, so this is the
   * whole perceived cost of a tab switch. */
  page: 0.16,
  /** A screen leaving. Runs BEFORE the entrance (AnimatePresence mode="wait"),
   * so it is pure dead time: fast enough to read as immediate. */
  pageOut: 0.09,
} as const

/** Standard easing - symmetric in/out (cubic-bezier(0.4, 0, 0.2, 1)). */
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const
/** Ease-out - for elements entering the screen. */
export const EASE_OUT = [0, 0, 0.2, 1] as const

// ─── Route transition ───────────────────────────────────────────────────────
// A restrained cross-fade with a small vertical drift - enough to read as
// "native screen change" without sliding the whole shell around. Only the
// CONTENT moves: the header and tab bar are rendered once by the shell and
// never re-enter (see AppShell in App.tsx).
//
// The exit is deliberately faster than the entrance and drops the drift: with
// mode="wait" the outgoing screen must finish before the new one starts, so
// every millisecond spent there is felt as lag on a tab tap. Total ≈ 250 ms.
export const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.page, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: DURATION.pageOut, ease: EASE_STANDARD } },
}
export const pageTransition = { duration: DURATION.page, ease: EASE_STANDARD }

// ─── List entrance ──────────────────────────────────────────────────────────
// Stagger children up into place. Use on a container with `variants` +
// `initial="hidden" animate="show"`, and give each child `variants={listItem}`.
export const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
}
export const listItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.standard, ease: EASE_OUT } },
}

// ─── Press feedback ─────────────────────────────────────────────────────────
// The canonical tap depress for interactive rows/tiles/buttons. Pair with
// `whileTap={tapScale}` on a `motion.*` element.
export const tapScale = { scale: 0.97 }
export const tapScaleSubtle = { scale: 0.985 }
