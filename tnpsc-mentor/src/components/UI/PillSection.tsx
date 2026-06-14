import type { ReactNode } from 'react'

interface PillSectionProps {
  /** Step heading (e.g. "STEP 1 · CHOOSE A GROUP"). */
  title: ReactNode
  /** Pill buttons (or any content) laid out in the centered wrap row. */
  children: ReactNode
  /** Extra classes on the <section> (e.g. spacing / animation). */
  className?: string
  /** When false, render `children` directly instead of the pill-wrap row
   *  (used for sections that manage their own loading/empty states). */
  wrap?: boolean
}

/**
 * A labelled selection step used across the picker screens: a centered,
 * uppercase heading above a wrapping row of pills. Replaces the heading +
 * `flex flex-wrap justify-center gap-3` block that was copied into every page.
 */
export default function PillSection({
  title,
  children,
  className = '',
  wrap = true,
}: PillSectionProps) {
  return (
    <section className={className}>
      <h3 className="tamil mb-3 text-center font-heading text-sm font-bold uppercase tracking-widest text-ink2">
        {title}
      </h3>
      {wrap ? (
        <div className="flex flex-wrap justify-center gap-3">{children}</div>
      ) : (
        children
      )}
    </section>
  )
}
