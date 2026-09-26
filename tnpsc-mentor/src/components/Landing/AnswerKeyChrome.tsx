import type { MouseEvent, ReactNode } from 'react'
import {
  ArrowRight,
  BookOpen,
  Facebook,
  Instagram,
  KeyRound,
  Languages,
  ListChecks,
  Newspaper,
  Send,
  Timer,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import type { LandingLang } from './LandingLangPrompt'

/**
 * The header, footer, features section and sticky mobile bar shared by every
 * answer-key page (the current-exam hubs in AnswerKeyPage.tsx and the
 * past-year papers in PastAnswerKeyPage.tsx) — identical chrome across both,
 * so it lives once here instead of drifting between two copies.
 */

export const INSTAGRAM_URL = 'https://www.instagram.com/mentorstnpsc/?hl=en'
export const YOUTUBE_URL = 'https://www.youtube.com/@TNPSCMentors4you'
export const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61591260240425&sk=about'
export const TELEGRAM_URL = 'https://t.me/+fnGJ6TbCiI8wNTY1'
export const TNPSC_OFFICIAL_URL = 'https://www.tnpsc.gov.in/'

export type AnswerKeyAppClick = (e: MouseEvent<HTMLAnchorElement>, source: string) => void

const FEATURES: { icon: LucideIcon; ta: { t: string; d: string }; en: { t: string; d: string } }[] = [
  {
    icon: Timer,
    ta: { t: 'மாதிரித் தேர்வுகள்', d: 'உண்மையான தேர்வு அறை போன்ற நேரக் கட்டுப்பாட்டுத் தேர்வுகள்.' },
    en: { t: 'Mock Tests', d: 'Full-length timed tests that feel like the real exam hall.' },
  },
  {
    icon: ListChecks,
    ta: { t: 'முந்தைய ஆண்டு வினாக்கள்', d: 'குரூப் 1, 2 & 4 — விளக்கத்துடன்.' },
    en: { t: 'Previous Year Questions', d: 'Group 1, 2 & 4 papers, with an explanation for every answer.' },
  },
  {
    icon: Newspaper,
    ta: { t: 'தினசரி நடப்பு நிகழ்வுகள்', d: 'தினமும் ஒரு சிறிய தேர்வு.' },
    en: { t: 'Daily Current Affairs', d: 'A short test on the latest news every day.' },
  },
  {
    icon: BookOpen,
    ta: { t: 'படிப்புப் பொருட்கள்', d: 'Videos, infographics, PDFs.' },
    en: { t: 'Study Materials', d: 'Videos, infographics and PDFs picked by our team.' },
  },
]

export function AnswerKeyHeader({
  onToggleLang,
  copy,
  appHref,
  onAppClick,
}: {
  onToggleLang: () => void
  copy: {
    navAnswerKey: string
    navFeatures: string
    navFaq: string
    openApp: string
    otherLang: string
    otherLangAria: string
  }
  appHref: string
  onAppClick: AnswerKeyAppClick
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3"
      >
        <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="TNPSC Mentors">
          <img src="/logo-mark.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
          <span className="hidden whitespace-nowrap font-heading text-base font-bold tracking-tight text-ink sm:inline">
            TNPSC <span className="text-brand">Mentors</span>
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {[
            { href: '#answer-key', label: copy.navAnswerKey },
            { href: '#features', label: copy.navFeatures },
            { href: '#faq', label: copy.navFaq },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="tamil rounded-lg px-3 py-2 font-heading text-[15px] font-bold text-ink transition hover:bg-brand-soft hover:text-brand-dark"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLang}
            aria-label={copy.otherLangAria}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-line bg-card px-3 font-heading text-sm font-bold text-ink transition hover:border-brand/40 hover:text-brand-dark"
          >
            <Languages size={16} className="text-brand" /> {copy.otherLang}
          </button>
          <a
            href={appHref}
            onClick={(e) => onAppClick(e, 'header')}
            className="btn-brand tamil min-h-[40px] shrink-0 px-4 text-sm"
          >
            {copy.openApp}
          </a>
        </div>
      </nav>
    </header>
  )
}

/**
 * A boxed sidebar list — violet header strip + divided rows — used for
 * "Related Links", the exam-group switcher and the year switcher alike, so a
 * visitor who landed on the wrong group/year is one tap away in the sidebar
 * rather than a row of pills competing with the H1 for attention.
 */
export function AnswerKeySidebarBox({
  title,
  items,
}: {
  title: string
  items: { href: string; label: string; active?: boolean }[]
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <p className="tamil border-b border-line bg-card px-4 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-brand-dark">
        {title}
      </p>
      <ul className="divide-y divide-line bg-card">
        {items.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              aria-current={l.active ? 'page' : undefined}
              className={
                l.active
                  ? 'tamil flex items-center justify-between gap-2 bg-gray-50 px-4 py-3 font-heading text-sm font-bold text-brand-dark dark:bg-white/5'
                  : 'tamil flex items-center justify-between gap-2 px-4 py-3 font-body text-sm font-medium text-ink transition hover:bg-gray-50 hover:text-brand-dark dark:hover:bg-white/5'
              }
            >
              {l.label}
              {!l.active && <ArrowRight size={14} className="shrink-0 text-ink2" />}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AnswerKeyFeaturesSection({
  lang,
  title,
  appLabel,
  appHref,
  onAppClick,
}: {
  lang: LandingLang
  title: string
  appLabel: string
  appHref: string
  onAppClick: AnswerKeyAppClick
}) {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="features-title" className="tamil text-center font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, ...f }) => (
            <div key={f.en.t} className="card p-5">
              <Icon size={22} className="text-brand" />
              <h3 className="tamil mt-3 font-heading text-base font-bold text-ink">{f[lang].t}</h3>
              <p className="tamil mt-1 font-body text-sm leading-relaxed text-ink2">{f[lang].d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <a
            href={appHref}
            onClick={(e) => onAppClick(e, 'features')}
            className="btn-wrap btn-brand tamil min-h-[48px] w-full max-w-sm px-7 text-sm sm:w-auto"
          >
            {appLabel} <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  )
}

export function AnswerKeyFaqSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-line bg-card">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 id="faq-title" className="tamil text-center font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
        <div className="mt-6 space-y-3">{children}</div>
      </div>
    </section>
  )
}

export function AnswerKeyFooter({
  tagline,
  followLabel,
  disclaimer,
}: {
  tagline: string
  followLabel: string
  disclaimer: string
}) {
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-sm">
            <div className="flex items-center gap-2.5">
              <img src="/logo-mark.png" alt="" className="h-8 w-8 object-contain" />
              <span className="font-heading text-sm font-bold text-ink">
                TNPSC <span className="text-brand">Mentors</span>
              </span>
            </div>
            <p className="tamil mt-3 font-body text-sm leading-relaxed text-ink2">{tagline}</p>
          </div>
          <div>
            <p className="tamil font-heading text-xs font-bold uppercase tracking-[0.16em] text-ink2">{followLabel}</p>
            <div className="mt-3 flex items-center gap-2.5">
              {[
                { href: YOUTUBE_URL, Icon: Youtube, label: 'YouTube' },
                { href: INSTAGRAM_URL, Icon: Instagram, label: 'Instagram' },
                { href: TELEGRAM_URL, Icon: Send, label: 'Telegram' },
                { href: FACEBOOK_URL, Icon: Facebook, label: 'Facebook' },
              ].map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-line pt-6 font-body text-xs text-ink2">
          <p className="tamil">© 2026 TNPSC Mentors · {disclaimer}</p>
        </div>
      </div>
    </footer>
  )
}

export function AnswerKeyStickyBar({
  answerKeyLabel,
  appLabel,
  appHref,
  onAppClick,
}: {
  answerKeyLabel: string
  appLabel: string
  appHref: string
  onAppClick: AnswerKeyAppClick
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-card/95 px-4 py-3 pb-safe backdrop-blur sm:hidden">
      <a href="#answer-key" className="btn-wrap btn-ghost tamil min-h-[48px] flex-1 px-3 text-sm">
        <KeyRound size={16} className="shrink-0" /> {answerKeyLabel}
      </a>
      <a
        href={appHref}
        onClick={(e) => onAppClick(e, 'sticky')}
        className="btn-wrap btn-brand tamil min-h-[48px] flex-1 px-3 text-sm"
      >
        {appLabel} <ArrowRight size={16} className="shrink-0" />
      </a>
    </div>
  )
}
