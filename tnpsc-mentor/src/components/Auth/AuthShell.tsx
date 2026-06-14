import type { ReactNode } from 'react'

interface AuthShellProps {
  /** The form card rendered on the right / center. */
  children: ReactNode
}

const CHIPS = ['Previous Year', 'Samacheer', 'Current Affairs', 'Aptitude']

/**
 * Shared split-screen auth layout: a royal-blue marketing hero on the left
 * (desktop) and the form panel on the right. Login, Register and Forgot all
 * share this so the auth flow is visually consistent. On phones the hero
 * collapses and a compact brand mark appears above the form.
 */
export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ─── Left: blue marketing hero (desktop only) ─────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-hero-grid [background-size:22px_22px] opacity-60" />
        <div className="relative animate-slideDown">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-lg font-semibold ring-1 ring-white/20">
              த
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">TNPSC Mentor</span>
          </div>
        </div>
        <div className="relative max-w-sm animate-slideUp">
          <h2 className="font-heading text-4xl font-bold leading-tight tracking-tight">
            Your fast track to the TNPSC exam hall.
          </h2>
          <p className="mt-4 font-body text-base text-white/75">
            12,000+ bilingual questions, timed mock tests, smart revision and
            progress insights — all in one focused workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {CHIPS.map((t, i) => (
              <span
                key={t}
                style={{ '--i': i } as React.CSSProperties}
                className="stagger-item rounded-full bg-white/10 px-3.5 py-1.5 font-heading text-xs font-medium text-white/90 ring-1 ring-white/15"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="relative font-body text-xs text-white/60">
          Tamil Nadu Public Service Commission · Aspirant Portal
        </div>
      </aside>

      {/* ─── Right: form panel ────────────────────────────────────────────── */}
      <div className="flex min-h-screen items-center justify-center bg-canvas bg-brand-radial px-4 py-10">
        <div className="w-full max-w-md animate-fadeIn">
          <div className="mb-7 flex flex-col items-center text-center lg:hidden">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-gradient text-xl font-semibold text-white">
              த
            </span>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">
              TNPSC Mentor
            </h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
