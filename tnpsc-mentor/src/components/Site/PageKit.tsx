import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IS_WEB } from '../../lib/platform'
import { useLanguageStore } from '../../store/languageStore'
import { AnswerKeyFooter } from '../Landing/AnswerKeyChrome'

// ─── Website page kit ───────────────────────────────────────────────────────
// Website STRUCTURE for the browser (crumbs, main + sidebar grid, footer) —
// the app's own visual design is kept (user, 2026-11-24 v2). Everything here is
// behind the `web:` variant or IS_WEB, so the installed app is unchanged.

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

// Website footer (browser only) - same destinations as the static archive's
// footer in scripts/qbank/render.mjs. The archive trees exist only on the apex
// host, never on app.tnpscmentors.in, hence the absolute URLs.
const SITE = 'https://tnpscmentors.in'
const FOOTER = {
  en: {
    tagline: 'TNPSC Group 1, Group 2 / 2A and Group 4 preparation, in Tamil and English.',
    follow: 'Follow us',
    disclaimer: 'Not affiliated with the Tamil Nadu Public Service Commission.',
    links: ['All questions', 'Past papers', 'Current affairs', 'Answer key', 'Privacy', 'Refund policy', 'Guidelines'],
  },
  ta: {
    tagline: 'TNPSC குரூப் 1, குரூப் 2 / 2A, குரூப் 4 தேர்வுப் பயிற்சி — தமிழிலும் ஆங்கிலத்திலும்.',
    follow: 'எங்களைப் பின்தொடருங்க',
    disclaimer: 'Tamil Nadu Public Service Commission-உடன் தொடர்பில்லை.',
    links: ['அனைத்து வினாக்கள்', 'வினாத்தாள்கள்', 'நடப்பு நிகழ்வுகள்', 'விடைக்குறிப்பு', 'தனியுரிமை', 'பணத்திருப்பக் கொள்கை', 'வழிகாட்டுதல்கள்'],
  },
}
const FOOTER_HREFS = [
  `${SITE}/`,
  `${SITE}/questions/past-papers/`,
  `${SITE}/current-affairs/`,
  `${SITE}/tnpsc-group-2-answer-key-2026`,
  '/privacy',
  '/refund-policy',
  '/guidelines',
]

/** The website footer (archive `footer.site`), used by AppLayout and AuthShell on web. */
export function SiteFooter() {
  const lang = useLanguageStore((s) => s.lang)
  const foot = FOOTER[lang === 'ta' ? 'ta' : 'en']
  return (
    <AnswerKeyFooter
      tagline={foot.tagline}
      followLabel={foot.follow}
      disclaimer={foot.disclaimer}
      links={foot.links.map((label, i) => ({ label, href: FOOTER_HREFS[i] }))}
    />
  )
}
