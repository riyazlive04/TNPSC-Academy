import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  GraduationCap,
  Newspaper,
  Calculator,
  Timer,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  Trophy,
  Bookmark,
  Languages,
  Sparkles,
  ArrowRight,
  Check,
  Target,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

// ─── Static content ──────────────────────────────────────────────────────────

const TRACKS = [
  {
    icon: BookOpen,
    title: 'Previous Year Papers',
    desc: 'Authentic PYQs for Group 1, Group 2/2A and Group 4 & VAO — practise the questions that actually appear.',
  },
  {
    icon: GraduationCap,
    title: 'Samacheer Foundation',
    desc: 'Class 6–10 Samacheer Kalvi, organised subject- and topic-wise so you build a rock-solid base.',
  },
  {
    icon: Newspaper,
    title: 'Current Affairs',
    desc: 'Month-wise and topic-wise current affairs, refreshed regularly so you are never out of date.',
  },
  {
    icon: Calculator,
    title: 'Aptitude & Reasoning',
    desc: 'Numerical aptitude and logical reasoning, broken into focused topics with steady difficulty.',
  },
]

const FEATURES = [
  {
    icon: Timer,
    title: 'Timed mock tests',
    desc: 'Full-length, time-boxed tests that recreate real exam-hall pressure so nothing surprises you on the day.',
  },
  {
    icon: RefreshCw,
    title: 'Smart revision',
    desc: 'A spaced-repetition engine resurfaces the questions you got wrong or flagged, exactly when you are about to forget them.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest, server-graded scores',
    desc: 'Answer keys never reach the browser. Grading happens on the server and explanations unlock once you attempt 25% — so scores mean something.',
  },
  {
    icon: BarChart3,
    title: 'Progress insights',
    desc: 'See subject- and topic-level accuracy, score trends over time, and where you rank against fellow aspirants.',
  },
  {
    icon: Sparkles,
    title: 'Daily current-affairs drill',
    desc: 'A quick ten-question daily set that turns staying current into a five-minute habit.',
  },
  {
    icon: Trophy,
    title: 'Streaks, levels & badges',
    desc: 'Daily goals, study streaks, XP levels and achievements keep momentum high through the long prep grind.',
  },
  {
    icon: Bookmark,
    title: 'Bookmarks & review',
    desc: 'Save tricky questions in one tap and revisit them later with full explanations whenever you choose.',
  },
  {
    icon: Languages,
    title: 'Fully bilingual',
    desc: 'Every question and screen in English, தமிழ், or both side-by-side — switch language anytime, instantly.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Pick your target',
    desc: 'Choose your group, set an exam date and a daily question goal during a 30-second setup.',
  },
  {
    n: '02',
    title: 'Practise & test',
    desc: 'Drill by category or take timed mock tests. Every attempt is graded fairly and explained.',
  },
  {
    n: '03',
    title: 'Revise & improve',
    desc: 'Smart revision and insights show you exactly what to fix next — and you watch your scores climb.',
  },
]

const STATS = [
  { value: '12,700+', label: 'Practice questions' },
  { value: '4', label: 'Exam tracks' },
  { value: '94%', label: 'Bilingual coverage' },
  { value: 'EN / தமிழ்', label: 'Anytime language switch' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate = useNavigate()
  const isAuthed = useAuthStore((s) => Boolean(s.user))

  const startTarget = isAuthed ? '/test-arena' : '/register'
  const startLabel = isAuthed ? 'Go to dashboard' : 'Get started free'

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas">
      {/* ─── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-line bg-card/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient font-heading text-sm font-bold text-white">
              த
            </span>
            <span className="font-heading text-base font-semibold tracking-tight text-ink">
              TNPSC <span className="text-brand">Mentor</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {!isAuthed && (
              <button
                onClick={() => navigate('/login')}
                className="rounded-xl px-3 py-2 font-heading text-sm font-semibold text-ink2 transition hover:text-brand-dark"
              >
                Sign in
              </button>
            )}
            <button
              onClick={() => navigate(startTarget)}
              className="btn-brand px-4 py-2 text-sm"
            >
              {isAuthed ? 'Dashboard' : 'Get started'}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16 lg:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 font-heading text-xs font-semibold text-brand-dark">
            <Target size={14} /> Built for Tamil Nadu Public Service Commission aspirants
          </span>
          <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Crack TNPSC with focused,
            <span className="text-brand"> bilingual practice.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl font-body text-base leading-relaxed text-ink2 sm:text-lg">
            One calm, structured workspace for every TNPSC aspirant — thousands of
            real questions, timed mock tests, smart revision and clear insights, in
            English and தமிழ். Prepare smarter, and walk into the hall confident.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => navigate(startTarget)}
              className="btn-brand w-full px-6 py-3.5 text-base sm:w-auto"
            >
              {startLabel} <ArrowRight size={18} />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-ghost w-full px-6 py-3.5 text-base sm:w-auto"
            >
              I already have an account
            </button>
          </div>
          <p className="mt-4 font-body text-sm text-ink2">
            Free to start · No card required · Switch language anytime
          </p>
        </div>

        {/* Hero panel / stat band */}
        <div className="hero-panel mx-auto mt-14 max-w-5xl p-6 sm:p-10">
          <div className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="min-w-0 text-center lg:text-left">
                <div className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 font-body text-sm text-white/65">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Practice tracks ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="What you can study"
          title="Four tracks that cover the whole syllabus"
          subtitle="Every part of the TNPSC pattern, organised the way you actually revise — by group, subject, topic and month."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRACKS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card min-w-0 p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon size={22} />
              </span>
              <h3 className="mt-4 font-heading text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-ink2">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="How it helps you win"
            title="Everything a serious aspirant needs"
            subtitle="Not just a question bank — a full preparation system that keeps you honest, consistent and improving."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="min-w-0">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 font-heading text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-ink2">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From first login to exam-ready in three steps"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="card min-w-0 p-6">
              <span className="font-heading text-3xl font-bold text-brand/30">{n}</span>
              <h3 className="mt-3 font-heading text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-ink2">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Mission ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="hero-panel grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
          <div className="min-w-0">
            <span className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Our aim
            </span>
            <h2 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              Make quality TNPSC preparation accessible to every aspirant.
            </h2>
            <p className="mt-4 font-body text-base leading-relaxed text-white/75">
              Good coaching shouldn't depend on your city, your budget or your
              language. TNPSC Mentor puts a structured, bilingual, data-driven
              preparation system in everyone's hands — so the only thing that
              decides your result is your effort.
            </p>
          </div>
          <div className="min-w-0 space-y-3">
            {[
              'Equal access — full prep in English and தமிழ்',
              'Honesty by design — fair grading you can trust',
              'Clarity, not guesswork — know exactly what to study next',
              'Consistency — habits and streaks that carry you to exam day',
            ].map((point) => (
              <div
                key={point}
                className="flex items-start gap-3 rounded-xl bg-white/10 px-4 py-3"
              >
                <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-white/20 text-white">
                  <Check size={13} />
                </span>
                <span className="font-body text-sm text-white/90">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Start preparing today.
        </h2>
        <p className="mx-auto mt-4 max-w-xl font-body text-base text-ink2">
          Join the aspirants building exam-ready habits with TNPSC Mentor. It's
          free to begin — your progress saves as you go.
        </p>
        <button
          onClick={() => navigate(startTarget)}
          className="btn-brand mx-auto mt-8 px-8 py-4 text-base"
        >
          {startLabel} <ArrowRight size={18} />
        </button>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient font-heading text-xs font-bold text-white">
              த
            </span>
            <span className="font-heading text-sm font-semibold text-ink">
              TNPSC <span className="text-brand">Mentor</span>
            </span>
          </div>
          <p className="font-body text-xs text-ink2">
            © {2026} TNPSC Mentor · An aspirant-first preparation platform. Not
            affiliated with the Tamil Nadu Public Service Commission.
          </p>
        </div>
      </footer>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-brand">
        {eyebrow}
      </span>
      <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 font-body text-base leading-relaxed text-ink2">{subtitle}</p>
      )}
    </div>
  )
}
