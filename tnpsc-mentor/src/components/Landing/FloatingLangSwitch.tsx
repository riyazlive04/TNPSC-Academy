import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Check, Languages } from 'lucide-react'

export type LandingLang = 'ta' | 'en'

// Each option is named in its own script, with the other language as a hint,
// so a reader of either language can find their own without reading the other.
const OPTIONS: { value: LandingLang; label: string; hint: string }[] = [
  { value: 'ta', label: 'தமிழ்', hint: 'Tamil' },
  { value: 'en', label: 'English', hint: 'ஆங்கிலம்' },
]

const STORAGE_KEY = 'tnpsc-landing-lang'

/**
 * The public landing pages' own language (Tamil unless the visitor chose
 * otherwise), remembered on this device.
 *
 * Deliberately separate from the app-wide languageStore: these pages are read
 * by guests who have not been through /language, and a choice made here should
 * not silently reconfigure the app they sign into. It IS remembered, though,
 * because the typical buyer leaves mid-page - to /register, and back here to
 * pay - and should not come back to the language they switched away from.
 */
export function useLandingLang(): [LandingLang, (lang: LandingLang) => void] {
  const [lang, setLangState] = useState<LandingLang>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ta'
    } catch {
      return 'ta'
    }
  })
  const setLang = useCallback((next: LandingLang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode / blocked storage: the choice still holds for this visit.
    }
  }, [])
  return [lang, setLang]
}

interface Props {
  lang: LandingLang
  onChange: (lang: LandingLang) => void
  /**
   * Vertical placement. A page with a fixed bottom bar lifts the button clear
   * of it; the default sits in the corner.
   */
  positionClassName?: string
  /**
   * Something the button must never sit on top of - a pay button that, on a
   * short phone screen, lands in the same bottom corner. While the two
   * overlap the button steps aside (fades out); it comes back as soon as a
   * scroll or resize separates them. The header toggle stays available.
   */
  avoidRef?: RefObject<HTMLElement | null>
}

/**
 * A floating language picker for the public landing / pay-link pages.
 *
 * The header already has a toggle, but on a phone it is a small "EN" chip at
 * the top of a page most visitors scroll straight past - this one stays in the
 * corner wherever they are. Tapping it opens a two-option menu rather than
 * flipping the language outright, so the control says what it does before it
 * does it. Stacks above the pages' sticky CTA bars (z-40) and below the
 * purchase sheet (z-[55]) and toasts (z-[60]).
 */
export default function FloatingLangSwitch({
  lang,
  onChange,
  positionClassName = 'bottom-11 sm:bottom-12',
  avoidRef,
}: Props) {
  const [open, setOpen] = useState(false)
  const [yielding, setYielding] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const fab = useRef<HTMLButtonElement>(null)

  // Hidden by opacity, never display:none, so the button keeps its box and the
  // overlap test below measures the same rect whether it is showing or not -
  // no show/hide flicker at the boundary.
  useEffect(() => {
    const target = avoidRef?.current
    const button = fab.current
    if (!target || !button) return
    let frame = 0
    const check = () => {
      frame = 0
      const a = target.getBoundingClientRect()
      const b = button.getBoundingClientRect()
      const overlap = a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
      setYielding(overlap)
      if (overlap) setOpen(false)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // The target's own size changes too (a language switch rewraps it).
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(target)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [avoidRef])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={root}
      className={`fixed right-4 z-[45] flex flex-col items-end gap-2 transition-opacity duration-200 sm:right-6 ${positionClassName} ${
        yielding ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-hidden={yielding || undefined}
    >
      {open && (
        <div
          role="menu"
          aria-label="மொழி / Language"
          className="w-48 origin-bottom-right animate-scaleIn rounded-card border border-line bg-card p-1.5 shadow-hero"
        >
          <p className="px-2.5 pb-1.5 pt-1 font-heading text-2xs font-bold uppercase tracking-wide text-ink2">
            மொழி · Language
          </p>
          {OPTIONS.map((o) => {
            const active = o.value === lang
            return (
              <button
                key={o.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 ${
                  active ? 'bg-brand-soft text-brand-dark' : 'text-ink hover:bg-tint'
                }`}
              >
                <span className="min-w-0">
                  <span className="tamil block font-heading text-sm font-semibold leading-tight">{o.label}</span>
                  <span className="tamil block font-body text-2xs leading-tight text-ink2">{o.hint}</span>
                </span>
                {active && <Check size={16} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}

      <button
        ref={fab}
        type="button"
        tabIndex={yielding ? -1 : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="மொழியை மாற்று / Change language"
        className="press flex h-12 items-center gap-1.5 rounded-full bg-brand pl-3.5 pr-4 font-heading text-sm font-bold text-white shadow-brand ring-1 ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <Languages size={18} className="shrink-0" />
        <span className="tamil">{lang === 'ta' ? 'தமிழ்' : 'EN'}</span>
      </button>
    </div>
  )
}
