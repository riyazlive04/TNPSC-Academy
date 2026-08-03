import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, BookOpen, CreditCard, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import {
  COMPANY,
  EFFECTIVE,
  LEGAL_DOCS,
  LEGAL_NAV,
  outstandingCompanyFacts,
  show,
} from '../lib/legalContent'

// ─── Policy pages ────────────────────────────────────────────────────────────
// Presentation only. All wording lives in src/lib/legalContent.ts, which is also
// what `npm run legal:export` turns into legal/*.md for the .docx merchant pack —
// so the published policy and the document you hand a payment provider can no
// longer drift apart, which is exactly what had happened before.

const ICONS: Record<string, typeof ShieldCheck> = {
  privacy: ShieldCheck,
  guidelines: BookOpen,
  payment: CreditCard,
  refund: RotateCcw,
  'delete-account': Trash2,
}

export default function PolicyPage({ slug }: { slug: string }) {
  const doc = LEGAL_DOCS[slug] ?? LEGAL_DOCS.privacy
  const Icon = ICONS[doc.slug] ?? ShieldCheck
  const effective = EFFECTIVE[doc.slug as keyof typeof EFFECTIVE] ?? ''

  useEffect(() => {
    document.title = `${doc.title} - TNPSC Mentors`
  }, [doc.title])

  // Dev-only. A policy that still says "to be confirmed" where a registered
  // address or Grievance Officer belongs is not publishable, and the failure
  // mode is that nobody notices — so it is made loud during development and
  // invisible to users.
  const outstanding = import.meta.env.DEV ? outstandingCompanyFacts() : []

  return (
    <div className="min-h-screen bg-canvas">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient font-heading text-sm font-bold text-white transition-transform duration-200 group-hover:scale-105">
              த
            </span>
            <span className="font-heading text-base font-semibold tracking-tight text-ink">
              TNPSC <span className="text-brand">Mentors</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand-dark"
          >
            <ArrowLeft size={16} /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        {outstanding.length > 0 && (
          <div className="mb-8 rounded-card border border-coral/40 bg-coral/5 p-4">
            <p className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
              <AlertTriangle size={16} className="flex-shrink-0 text-coral" />
              {outstanding.length} legal fact{outstanding.length === 1 ? '' : 's'} still outstanding
              (dev-only notice)
            </p>
            <ul className="mt-2 space-y-1">
              {outstanding.map((f) => (
                <li key={f} className="font-body text-xs text-ink2">
                  · {f}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-body text-xs text-ink2">
              Fill these in <code>src/lib/legalContent.ts</code> → <code>COMPANY</code>. See
              docs/LEGAL_HANDOFF.md.
            </p>
          </div>
        )}

        {/* Title */}
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-tile bg-brand-soft text-brand">
            <Icon size={24} />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {doc.title}
            </h1>
            <p className="font-body text-sm text-ink2">Effective: {effective}</p>
          </div>
        </div>

        {/* Policy switcher */}
        <nav className="mt-6 flex flex-wrap gap-2">
          {LEGAL_NAV.map((n) => (
            <Link
              key={n.slug}
              to={n.path}
              className={`rounded-pill px-3.5 py-1.5 font-heading text-xs font-semibold transition ${
                n.slug === doc.slug
                  ? 'bg-brand-gradient text-white'
                  : 'border border-line bg-card text-ink2 hover:border-brand/40 hover:text-brand-dark'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Intro */}
        <p className="mt-8 font-body text-base leading-relaxed text-ink2">{doc.intro}</p>

        {/* Blocks */}
        <div className="mt-8 space-y-7">
          {doc.blocks.map((b) => (
            <section key={b.h}>
              <h2 className="font-heading text-lg font-semibold tracking-tight text-ink">{b.h}</h2>
              {b.p?.map((para, i) => (
                <p key={i} className="mt-2 font-body text-[15px] leading-relaxed text-ink2">
                  {para}
                </p>
              ))}
              {b.list && (
                <ul className="mt-3 space-y-2">
                  {b.list.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
                      <span className="font-body text-[15px] leading-relaxed text-ink2">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Operator identity — required by India's Consumer Protection
            (E-Commerce) Rules 2020 and expected by both app stores. */}
        <div className="mt-10 rounded-card border border-line bg-card p-5">
          <p className="font-heading text-sm font-semibold text-ink">Operator</p>
          <div className="mt-2 space-y-1 font-body text-sm text-ink2">
            <p>{show(COMPANY.legalName, COMPANY.operator)}, trading as {COMPANY.tradeName}</p>
            <p>{show(COMPANY.address)}</p>
            {!COMPANY.gstin.startsWith('TODO:') && <p>GSTIN: {COMPANY.gstin}</p>}
            <p>
              <a href={`mailto:${COMPANY.supportEmail}`} className="text-brand hover:text-brand-dark">
                {COMPANY.supportEmail}
              </a>{' '}
              · {COMPANY.supportPhone}
            </p>
            <p className="pt-1">
              Grievance Officer: {show(COMPANY.grievanceOfficerName)} ·{' '}
              {show(COMPANY.grievanceEmail, COMPANY.supportEmail)}
            </p>
          </div>
        </div>

        <p className="mt-10 border-t border-line pt-6 font-body text-xs leading-relaxed text-ink2">
          © 2026 {COMPANY.tradeName}. An independent preparation product — not affiliated with,
          endorsed by, or connected to the Tamil Nadu Public Service Commission.
        </p>
      </main>
    </div>
  )
}
