import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { translate } from '../../lib/i18n'
import type { Lang } from '../../store/languageStore'

/**
 * The band that tells a visitor on a PUBLIC Group 1 page that the 2026 prelims
 * has already been sat (27 Sep 2026).
 *
 * These pages are reached by links that are still in circulation — ads, WhatsApp
 * forwards, the "₹399 plan" short links — and they are full of prices and Pay
 * buttons. Once Group 1 is archived the server refuses those plans, so without
 * this band a visitor reads a live offer, taps Pay and gets a silent redirect:
 * the worst of the possible outcomes, because it looks like the site is broken
 * rather than like the exam is finished. So this replaces the price bands
 * outright instead of sitting underneath them.
 *
 * Takes `lang` rather than calling useT: the public landing pages run on their
 * own per-device landing language (useLandingLang), not the app-wide store, and
 * a banner that ignored that would show Tamil visitors English.
 */
export default function Group1RetiredBanner({
  lang,
  nextHref = '/group-2-test-series',
}: {
  lang: Lang
  /** The live exam to send them to instead. Group II/IIA by default — it is the
   *  nearest thing to what a Group 1 visitor came for. Pass null on a page that
   *  already IS that destination, where the button would point at itself. */
  nextHref?: string | null
}) {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang)

  return (
    <section className="border-b border-line bg-tint">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-card text-muted">
            <CheckCircle2 size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="tamil font-heading text-base font-bold leading-tight text-ink sm:text-lg">
              {t('g1ArchivedTitle')}
            </h2>
            <p className="tamil mt-1 font-body text-sm leading-snug text-ink2">
              {t('g1ArchivedBody')}
            </p>
          </div>
        </div>

        {nextHref && (
          <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
            <a
              href={nextHref}
              className="btn-wrap press inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 font-heading text-sm font-bold text-white shadow-brand transition hover:brightness-105 sm:w-auto"
            >
              {t('g1ArchivedNextCta')} <ArrowRight size={15} className="flex-shrink-0" />
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
