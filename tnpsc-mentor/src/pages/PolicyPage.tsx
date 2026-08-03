import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, BookOpen, CreditCard, RotateCcw, Trash2 } from 'lucide-react'

// ─── Policy content ──────────────────────────────────────────────────────────
// Plain-English legal/policy copy for the public site, grounded in how the app
// actually works (one-time ₹1,699 Group 1 kit, Razorpay UPI/card, digital
// content, no subscription). Reviewed and verified by an advocate on
// 24 June 2026; bracketed placeholders have been finalised.

const SUPPORT_EMAIL = 'support@tnpscmentors.in'
const SUPPORT_PHONE = '+91 96777 79808'
const LAST_UPDATED = '24 June 2026'

type Block =
  | { h: string; p: string[] }
  | { h: string; list: string[] }

type Policy = {
  slug: string
  title: string
  icon: typeof ShieldCheck
  intro: string
  blocks: Block[]
}

const PRIVACY: Policy = {
  slug: 'privacy',
  title: 'Privacy Policy',
  icon: ShieldCheck,
  intro:
    'This Privacy Policy explains what TNPSC Mentors (operated by Sirah Digital, "we", "us") collects, why, and your choices. By using the app or website you agree to this Policy.',
  blocks: [
    {
      h: '1. Information we collect',
      list: [
        'Account details you provide: name, email, phone, preferred language, target group and (optionally) gender.',
        'Usage data: tests attempted, answers, scores, streaks, bookmarks and progress - used to power your analytics and revision.',
        'Device & session data: a randomly generated installation identifier and a device label, used to enforce the 2-device login limit and keep your account secure. This is not an advertising identifier and is not shared with anyone.',
        'Payment data: on the website, payments are handled by Razorpay. In the Android and iOS apps, payments are handled by Google Play and the App Store respectively. In every case we store only the order/payment reference, amount and status - never your card details.',
        'Notification tokens: if you turn notifications on, the push token issued by your browser or by Apple/Google, so we can send you the alerts you asked for.',
      ],
    },
    {
      h: '1a. Tracking and advertising',
      p: [
        'The Android and iOS apps contain NO third-party advertising, analytics or tracking SDKs. We do not track you across other companies’ apps or websites, and we do not share your data with data brokers or advertising networks.',
        'The website (tnpscmentors.in) does use Google Analytics via Google Tag Manager, Microsoft Clarity and the Meta Pixel to understand how the site is used and to measure our own advertising. You can opt out with any standard browser tracking blocker.',
      ],
    },
    {
      h: '2. How we use it',
      list: [
        'To provide the service: deliver questions, grade tests on our server, and save your progress.',
        'To personalise: surface revisions, insights and recommendations.',
        'To secure accounts: detect misuse and manage device sessions.',
        'To communicate: important notices and, if you opt in, study notifications.',
      ],
    },
    {
      h: '3. Sharing',
      p: [
        'We do not sell your personal data. We share data only with the service providers that run the product - Supabase (database and authentication), Razorpay (website payments), Apple and Google (in-app purchases and push delivery), and our hosting provider - under their terms, and only as needed to operate the service or comply with law.',
      ],
    },
    {
      h: '4. Data retention and deletion',
      p: [
        'We keep your data while your account is active. You can delete your account and all associated data yourself at any time from Profile → Account → Delete account; deletion is immediate and irreversible. Full details, including how to request deletion if you cannot sign in, are on the "Delete account" page.',
        'Payment and invoice records are retained afterwards for as long as Indian tax and accounting law requires, for statutory compliance only.',
      ],
    },
    {
      h: '5. Your choices',
      list: [
        'Access or correct your profile details inside the app.',
        'Turn notifications on or off at any time, in the app and in your device settings.',
        'Delete your account and all your data from Profile → Account, without contacting us.',
        'Request a copy of your data by email.',
      ],
    },
    {
      h: '6. Children',
      p: ['The app is intended for exam aspirants. It is not directed at children under 13.'],
    },
    {
      h: '7. Changes & contact',
      p: [
        `We may update this Policy; the "last updated" date will change accordingly. Questions? Email ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
}

const GUIDELINES: Policy = {
  slug: 'guidelines',
  title: 'Guidelines',
  icon: BookOpen,
  intro:
    'These guidelines keep TNPSC Mentors fair, useful and safe for every aspirant. Using the app means you agree to follow them.',
  blocks: [
    {
      h: '1. One account, your own',
      list: [
        'Create one account with accurate details and keep your login private.',
        'Do not share, sell or transfer your account. A 2-device limit applies; you can sign out other devices from your profile.',
      ],
    },
    {
      h: '2. Fair use of content',
      list: [
        'Questions, explanations, mock tests and study material are for your personal exam preparation only.',
        'Do not copy, redistribute, resell, screen-record in bulk, or scrape the content.',
        'Do not attempt to bypass grading, paywalls, or the proctoring in mock tests.',
      ],
    },
    {
      h: '3. Honest practice',
      list: [
        'Mock tests are most useful when attempted genuinely - treat them like the real exam.',
        'Report wrong questions or errors using the in-app "report" option so we can fix them.',
      ],
    },
    {
      h: '4. Respectful conduct',
      p: [
        'Any feedback or communication with our team should be respectful. Abuse, fraud, or attempts to harm the service or other users may lead to suspension.',
      ],
    },
    {
      h: '5. Accuracy & no guarantee',
      p: [
        'We work hard to keep content accurate and aligned to the TNPSC pattern, but we do not guarantee any exam result. The app is an independent preparation tool and is not affiliated with the Tamil Nadu Public Service Commission.',
      ],
    },
    {
      h: '6. Contact',
      p: [`Questions about these guidelines? Email ${SUPPORT_EMAIL} or message ${SUPPORT_PHONE}.`],
    },
  ],
}

const PAYMENT: Policy = {
  slug: 'payment',
  title: 'Payment Policy',
  icon: CreditCard,
  intro:
    'This Payment Policy explains pricing and how payments work for the TNPSC Mentors Group 1 Prelims Kit. Payments are processed securely by Razorpay.',
  blocks: [
    {
      h: '1. What you pay for',
      p: [
        'The Group 1 Prelims Kit is a one-time purchase of ₹1,699 that unlocks the paid digital content (previous-year papers, unlimited tests, proctored mocks, current affairs, revision plan, formula sheet and trend report). A free starter tier is available without payment.',
      ],
    },
    {
      h: '2. One-time, no subscription',
      list: [
        'The Kit is a single payment - there is no auto-renewal and no recurring billing.',
        'Access is valid until the TNPSC Group 1 Prelims exam, as described at the time of purchase.',
      ],
    },
    {
      h: '3. How to pay',
      list: [
        'Payments are made inside the app via Razorpay using UPI or card.',
        'We receive the payment status and an order/payment reference; we do not store your full card details.',
      ],
    },
    {
      h: '4. Pricing, taxes & coupons',
      list: [
        'Prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise.',
        'Valid coupons reduce the amount payable; the final price is always recomputed and confirmed before you pay.',
        'We may change prices or offers for future purchases; your completed purchase is unaffected.',
      ],
    },
    {
      h: '5. Payment issues',
      p: [
        `If money is deducted but access is not granted, contact ${SUPPORT_EMAIL} with your Razorpay payment/order ID - we will verify and resolve it. See our Return & Cancellation Policy for refund eligibility.`,
      ],
    },
  ],
}

const REFUND: Policy = {
  slug: 'refund',
  title: 'Return & Cancellation Policy',
  icon: RotateCcw,
  intro:
    'This policy explains refunds and cancellations for purchases made in TNPSC Mentors. Payments are processed by Razorpay.',
  blocks: [
    {
      h: '1. Digital content - general rule',
      p: [
        'The Group 1 Prelims Kit unlocks digital content immediately on payment. Once the Kit is unlocked and the content has been accessed, the purchase is generally non-refundable, as digital content cannot be returned. We offer a free starter tier so you can evaluate the app before paying.',
      ],
    },
    {
      h: '2. When you are eligible for a refund',
      list: [
        'Duplicate payment - you were charged more than once for the same Kit.',
        'Payment deducted but access not granted, and we cannot activate it within a reasonable time.',
        'A failed or erroneous transaction caused an incorrect charge.',
        'A significant, reproducible technical fault prevents access to the core paid content and our team cannot resolve it within 7 days of you reporting it.',
      ],
    },
    {
      h: '3. When you are not eligible',
      list: [
        'Change of mind or accidental purchase after the content has been accessed.',
        'Dissatisfaction with your own preparation, results or outcomes (we do not guarantee results).',
        'Issues caused by your device, OS or internet connection.',
        'Requests made after the window in Section 4, except where required by law.',
      ],
    },
    {
      h: '4. Refund window',
      p: ['Eligible requests must be raised within 7 days of the transaction date.'],
    },
    {
      h: '5. How to request',
      p: [
        `Email ${SUPPORT_EMAIL} (or WhatsApp ${SUPPORT_PHONE}) with your registered name, the email/phone used, the Razorpay payment/order ID, date and amount, and the reason. We aim to decide within 7 business days.`,
      ],
    },
    {
      h: '6. How refunds are processed',
      list: [
        'Approved refunds are issued to the original payment method via Razorpay.',
        'It typically reflects within 5-10 business days, depending on your bank/UPI provider.',
        'Refunds are limited to the amount actually paid; coupons are not separately refundable.',
      ],
    },
    {
      h: '7. Cancellations',
      p: [
        'The Kit is a one-time purchase with no subscription, so there is nothing to cancel after purchase. A completed purchase can only be refunded under the conditions above.',
      ],
    },
  ],
}

// Google Play's User Data policy requires BOTH an in-app deletion path (Profile →
// Account → Delete account) and a publicly reachable web URL where deletion can be
// requested WITHOUT installing the app. This page is that URL, and it is what goes
// in the Play Console Data safety form's "Account deletion URL" field.
const DELETE_ACCOUNT: Policy = {
  slug: 'delete-account',
  title: 'Delete your account',
  icon: Trash2,
  intro:
    'You can permanently delete your TNPSC Mentors account and all data associated with it at any time. Deletion is immediate and cannot be undone.',
  blocks: [
    {
      h: '1. Delete it yourself, in the app',
      list: [
        'Open the TNPSC Mentors app (or tnpscmentors.in) and sign in.',
        'Go to Profile → Account.',
        'Tap "Delete account", type DELETE to confirm, and confirm again.',
        'Your account is removed straight away and you are signed out.',
      ],
    },
    {
      h: '2. Or ask us to delete it',
      p: [
        `If you cannot sign in, email ${SUPPORT_EMAIL} from the address registered on the account, with the subject "Delete my account". We verify ownership of the address and complete the deletion within 7 working days, and confirm by email when it is done.`,
      ],
    },
    {
      h: '3. What gets deleted',
      list: [
        'Your profile: name, email, phone number, language, target group and exam date.',
        'Your work: every test attempt, answer, score, bookmark, revision deck and progress record.',
        'Your credit balance and streak history.',
        'Your notification subscriptions and registered devices.',
        'Any question reports or feedback you submitted, and their link to you.',
      ],
    },
    {
      h: '4. What we keep, and for how long',
      p: [
        'Payment and invoice records are retained for as long as Indian tax and accounting law requires (currently 8 financial years). These are kept for statutory compliance only, are not used to profile you, and hold no test data — just the transaction reference, amount and date.',
      ],
    },
    {
      h: '5. Paid plans and refunds',
      p: [
        'Deleting your account ends any active Premium or Vettri Nichayam plan immediately and does NOT trigger a refund. If you believe you are owed one, read the Refund & Cancellation policy and contact support BEFORE deleting — once the account is gone we can no longer verify your entitlement.',
        'Purchases made through the App Store or Google Play are refunded by Apple or Google under their own policies, not by us.',
      ],
    },
  ],
}

const POLICIES: Record<string, Policy> = {
  privacy: PRIVACY,
  guidelines: GUIDELINES,
  payment: PAYMENT,
  refund: REFUND,
  'delete-account': DELETE_ACCOUNT,
}

const NAV: { slug: string; label: string }[] = [
  { slug: 'privacy', label: 'Privacy' },
  { slug: 'guidelines', label: 'Guidelines' },
  { slug: 'payment', label: 'Payment' },
  { slug: 'refund', label: 'Refund & Cancellation' },
  { slug: 'delete-account', label: 'Delete account' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PolicyPage({ slug }: { slug: string }) {
  const policy = POLICIES[slug] ?? PRIVACY
  const Icon = policy.icon

  useEffect(() => {
    document.title = `${policy.title} - TNPSC Mentors`
  }, [policy.title])

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
        {/* Title */}
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-tile bg-brand-soft text-brand">
            <Icon size={24} />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {policy.title}
            </h1>
            <p className="font-body text-sm text-ink2">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        {/* Policy switcher */}
        <nav className="mt-6 flex flex-wrap gap-2">
          {NAV.map((n) => (
            <Link
              key={n.slug}
              to={`/${n.slug === 'payment' ? 'payment-policy' : n.slug === 'refund' ? 'refund-policy' : n.slug}`}
              className={`rounded-pill px-3.5 py-1.5 font-heading text-xs font-semibold transition ${
                n.slug === policy.slug
                  ? 'bg-brand-gradient text-white'
                  : 'border border-line bg-card text-ink2 hover:border-brand/40 hover:text-brand-dark'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Intro */}
        <p className="mt-8 font-body text-base leading-relaxed text-ink2">{policy.intro}</p>

        {/* Blocks */}
        <div className="mt-8 space-y-7">
          {policy.blocks.map((b) => (
            <section key={b.h}>
              <h2 className="font-heading text-lg font-semibold tracking-tight text-ink">{b.h}</h2>
              {'p' in b &&
                b.p.map((para, i) => (
                  <p key={i} className="mt-2 font-body text-[15px] leading-relaxed text-ink2">
                    {para}
                  </p>
                ))}
              {'list' in b && (
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

        {/* Contact card */}
        <div className="mt-10 rounded-card border border-line bg-card p-5">
          <p className="font-heading text-sm font-semibold text-ink">Contact</p>
          <p className="mt-1 font-body text-sm text-ink2">
            Sirah Digital ·{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:text-brand-dark">
              {SUPPORT_EMAIL}
            </a>{' '}
            · {SUPPORT_PHONE}
          </p>
          <p className="mt-3 font-body text-xs italic text-ink2">
            Reviewed and verified by an advocate on 24 June 2026.
          </p>
        </div>

        <p className="mt-10 border-t border-line pt-6 font-body text-xs text-ink2">
          © {2026} TNPSC Mentors · Not affiliated with the Tamil Nadu Public Service Commission.
        </p>
      </main>
    </div>
  )
}
