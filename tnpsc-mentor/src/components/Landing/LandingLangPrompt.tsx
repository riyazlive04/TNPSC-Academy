import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { useFocusTrap } from '../UI/useFocusTrap'

export type LandingLang = 'ta' | 'en'

const STORAGE_KEY = 'tnpsc-landing-lang'

/**
 * The public landing pages' own language, remembered on this device, plus
 * whether the visitor has chosen one yet (until they have, the page shows
 * Tamil behind LandingLangPrompt).
 *
 * Deliberately separate from the app-wide languageStore: these pages are read
 * by guests who have not been through /language, and a choice made here should
 * not silently reconfigure the app they sign into. It IS remembered, though,
 * because the typical buyer leaves mid-page - to /register, and back here to
 * pay - and should neither be asked again nor come back to the other language.
 */
export function useLandingLang(): [LandingLang, (lang: LandingLang) => void, boolean] {
  const [state, setState] = useState<{ lang: LandingLang; chosen: boolean }>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'ta' || stored === 'en') return { lang: stored, chosen: true }
    } catch {
      // Blocked storage: ask once per visit instead.
    }
    return { lang: 'ta', chosen: false }
  })
  const setLang = useCallback((lang: LandingLang) => {
    setState({ lang, chosen: true })
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Private mode / blocked storage: the choice still holds for this visit.
    }
  }, [])
  return [state.lang, setLang, state.chosen]
}

// Fixed colours rather than theme tokens: white labels must stay legible on
// both buttons in light and dark mode, and the dark theme lifts --c-sky and
// --c-accentwarm too far for that. Each language is named in its own script.
const OPTIONS: { value: LandingLang; label: string; className: string }[] = [
  { value: 'ta', label: 'தமிழ்', className: 'bg-[#E4572E] focus-visible:ring-[#E4572E]/40' },
  { value: 'en', label: 'English', className: 'bg-[#2A5DB0] focus-visible:ring-[#2A5DB0]/40' },
]

/**
 * "Select your language" popup for the public landing / pay-link pages.
 *
 * Shown to a first-time visitor over the page, with no close button - the only
 * way out is to pick a language, which dismisses it for good on this device.
 * The header's own language toggle stays for changing it later. Stacks above
 * the pages' sticky CTA bars (z-40) and headers (z-30), at the purchase
 * sheet's level (z-[55]) - the two never open together - and below toasts
 * (z-[60]).
 */
export default function LandingLangPrompt({
  open,
  onChoose,
}: {
  open: boolean
  onChoose: (lang: LandingLang) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(open, dialogRef)

  // The page behind must not scroll while the choice is pending.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto bg-ink/50 p-4 animate-fadeInFast backdrop-blur-sm"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-lang-title"
        tabIndex={-1}
        className="w-full max-w-sm animate-sheetIn rounded-3xl border border-line bg-card p-5 shadow-card outline-none sm:p-6"
      >
        <div className="flex items-center gap-3">
          <img src="/logo-mark.png" alt="" className="h-12 w-12 shrink-0 object-contain" />
          <p className="font-heading text-lg font-bold tracking-tight text-ink">
            TNPSC <span className="text-brand">Mentors</span>
          </p>
        </div>

        <h2 id="landing-lang-title" className="mt-5">
          <span className="tamil block font-heading text-base font-bold text-ink">மொழியைத் தேர்ந்தெடுக்கவும்</span>
          <span className="block font-heading text-sm font-semibold text-ink2">Select your language</span>
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              lang={o.value}
              onClick={() => onChoose(o.value)}
              className={`press flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left font-heading text-xl font-bold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 ${o.className}`}
            >
              <span className="tamil">{o.label}</span>
              <ChevronRight size={22} className="shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
