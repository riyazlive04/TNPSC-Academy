import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IS_WEB } from '../../lib/platform'

// ─── Website page kit ───────────────────────────────────────────────────────
// The public archive's page parts (scripts/qbank/render.mjs: .crumbs, .layout,
// .sec-block) as React. Every web look is behind the `web:` variant or IS_WEB,
// so the installed app renders exactly what it did before.

/**
 * Page container. Native keeps the page's own column width; the browser gets
 * the website's 6xl shell and, with an `aside`, the main + 300px sidebar grid
 * (stacked under 1024px). The aside is web-only.
 */
export function PageGrid({
  children,
  aside,
  nativeWidth = 'max-w-2xl',
  className = '',
}: {
  children: ReactNode
  aside?: ReactNode
  /** The column width the page used before (kept on Android). */
  nativeWidth?: string
  className?: string
}) {
  const side = IS_WEB && aside
  return (
    <div className={`mx-auto w-full px-4 ${nativeWidth} web:max-w-6xl web:sm:px-6 ${className}`}>
      <div className={side ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10' : ''}>
        <div className="min-w-0">{children}</div>
        {side && <aside className="mt-8 min-w-0 lg:sticky lg:top-24 lg:mt-0">{aside}</aside>}
      </div>
    </div>
  )
}

/** Archive hero eyebrow pill, for a page's section badge (browser only). */
export const WEB_EYEBROW =
  'web:inline-flex web:rounded-full web:bg-brand-soft web:px-3 web:py-1.5 web:font-heading web:text-[12.5px] web:font-bold web:normal-case web:tracking-normal web:text-brand-dark'

export interface Crumb {
  label: ReactNode
  /** In-app path; omit on the current page (the last crumb). */
  to?: string
}

/** Pill breadcrumbs (archive `.crumbs`). Browser only — the app has its back button. */
export function Crumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  if (!IS_WEB || items.length === 0) return null
  const pill = 'tamil inline-block max-w-full truncate rounded-full border px-3 py-1 font-body text-[12.5px]'
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-[7px]">
        {items.map((c, i) => (
          <li key={i} className="min-w-0 max-w-full">
            {c.to ? (
              <Link
                to={c.to}
                className={`${pill} focus-ring border-line bg-card text-ink2 transition hover:border-brand/40 hover:text-brand-dark`}
              >
                {c.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className={`${pill} max-w-[32ch] border-transparent bg-brand-soft font-semibold text-brand-dark`}
              >
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * A named section (archive `.sec-block`): a card in the browser, plain grouping
 * by space on Android (the app's list-led look).
 */
export function SectionBlock({
  title,
  children,
  id,
  className = '',
}: {
  title?: ReactNode
  children: ReactNode
  id?: string
  className?: string
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 web:my-4 web:rounded-card web:border web:border-line web:bg-card web:p-5 web:shadow-soft web:sm:px-[26px] web:sm:py-6 ${className}`}
    >
      {title && (
        <h2 className="tamil mb-3 font-display text-base font-semibold tracking-tight text-ink web:text-[19px] web:font-bold web:leading-snug">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
