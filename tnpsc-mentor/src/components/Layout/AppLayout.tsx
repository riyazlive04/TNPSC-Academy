import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, ShieldCheck, RefreshCw, User, BarChart3, Sun, Moon, Flag, Library, CalendarDays, Trophy, Eye, EyeOff, Coins } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCreditsStore } from '../../store/creditsStore'
import { useHasMaterials } from '../../hooks/useHasMaterials'
import { useTestSeriesEnabled } from '../../hooks/useTestSeriesEnabled'
import { useVettriEnabled } from '../../hooks/useVettriEnabled'
import { useLanguageStore, type Lang } from '../../store/languageStore'
import { useThemeStore } from '../../store/themeStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { api } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { getTestsCompleted, TESTS_BEFORE_FEEDBACK } from '../../lib/testProgress'
import Avatar from '../UI/Avatar'
import FeedbackModal from '../Feedback/FeedbackModal'
import NotificationBell from './NotificationBell'
import BackToTopButton from './BackToTopButton'
import AlertPopup from './AlertPopup'

interface AppLayoutProps {
  children: ReactNode
  /** Hide the chrome (top bar + bottom nav) for the immersive quiz screen. */
  bare?: boolean
}

const LANG_LABEL: Record<Lang, string> = { en: 'EN', ta: 'தமிழ்', both: 'EN+த' }
const LANG_CYCLE: Lang[] = ['en', 'ta', 'both']

// Feedback is accepted once every 3 months. The stored value is the last
// submission's epoch (ms); returns true while still inside that window.
const FEEDBACK_WINDOW_MS = 92 * 24 * 60 * 60 * 1000 // ~3 months
function withinFeedbackWindow(key: string | null): boolean {
  if (!key) return false
  const last = Number(localStorage.getItem(key))
  return Number.isFinite(last) && last > 0 && Date.now() - last < FEEDBACK_WINDOW_MS
}

// Learner navigation - the personal study tabs (spaced revision, progress
// insights, profile) shown to regular users. The same list drives both the
// desktop top nav and the mobile bottom bar; each entry is gated by its feature
// flag below, so the bar only grows when a feature is turned on.
const LEARNER_NAV = [
  { to: '/test-arena', icon: Home, key: 'home' as const, short: 'home' as const },
  { to: '/vettri', icon: Trophy, key: 'vettriNav' as const, short: 'vettriNav' as const },
  { to: '/test-series', icon: CalendarDays, key: 'testSeries' as const, short: 'testSeries' as const },
  { to: '/revision', icon: RefreshCw, key: 'revision' as const, short: 'revision' as const },
  { to: '/materials', icon: Library, key: 'materials' as const, short: 'materials' as const },
  { to: '/insights', icon: BarChart3, key: 'insights' as const, short: 'navInsights' as const },
  { to: '/profile', icon: User, key: 'profile' as const, short: 'profile' as const },
]

// Admin/superadmin navigation - content managers don't use the personal
// learner-progress tabs, so the nav is the Test Arena (their gateway to the
// question banks via the same picker) plus the student-report triage queue.
const ADMIN_NAV = [
  { to: '/test-arena', icon: Home, key: 'home' as const, short: 'home' as const },
  { to: '/admin/reports', icon: Flag, key: 'reports' as const, short: 'reports' as const },
]

/**
 * Shared app shell - soft light canvas, a clean top brand bar, and a responsive
 * bottom tab bar (the primary navigation on phones; centred on larger screens).
 */
export default function AppLayout({ children, bare = false }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, isAdmin, isSuperAdmin, user, realIsAdmin, previewAsStudent, setPreviewAsStudent } =
    useAuth()

  // Admins can preview the learner experience. Entering/leaving preview homes to
  // the arena so the switch lands on a sensible screen in the target mode.
  const enterStudentPreview = () => {
    setPreviewAsStudent(true)
    navigate('/test-arena')
  }
  const exitStudentPreview = () => {
    setPreviewAsStudent(false)
    navigate('/test-arena')
  }
  const { t } = useT()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // Feedback is accepted once per 3 months (enforced server-side). After a user
  // rates the app we hide the entry point for that window, then surface it again.
  // Persisted per-user in localStorage as the last-submission epoch (no request).
  const feedbackKey = user?.id ? `tnpsc:feedbackGiven:${user.id}` : null
  const [feedbackGiven, setFeedbackGiven] = useState(
    () => withinFeedbackWindow(feedbackKey)
  )
  const lang = useLanguageStore((s) => s.lang) ?? 'en'
  const setLang = useLanguageStore((s) => s.setLang)
  const resolvedTheme = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)

  // Credit balance + daily +10 check-in — fetched once per session on first load.
  const creditsLoaded = useCreditsStore((s) => s.loaded)
  const refreshCredits = useCreditsStore((s) => s.refresh)
  useEffect(() => {
    if (user && !creditsLoaded) refreshCredits()
  }, [user, creditsLoaded, refreshCredits])
  // The first-run tour owns the screen for new accounts - don't let the periodic
  // feedback prompt pop over it.
  const tourActive = useOnboardingStore((s) => s.open || s.pending)

  // Admins/superadmins manage content; learners get the study tabs. The
  // Materials tab is shown only once a material has been published (no empty tab).
  const hasMaterials = useHasMaterials()
  const testSeriesOn = useTestSeriesEnabled()
  const vettriOn = useVettriEnabled()
  // Same nav for desktop top bar + mobile bottom bar; gated per feature flag.
  const nav = isAdmin
    ? ADMIN_NAV
    : LEARNER_NAV.filter(
        (item) =>
          (item.to !== '/materials' || hasMaterials) &&
          (item.to !== '/test-series' || testSeriesOn) &&
          (item.to !== '/vettri' || vettriOn)
      )

  // Badge: number of open student question-reports awaiting triage (admins only).
  const [openReports, setOpenReports] = useState(0)
  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    api
      .adminOpenReportCount()
      .then((n) => !cancelled && setOpenReports(n))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  // Re-read once the auth bootstrap resolves the user id (key starts out null).
  useEffect(() => {
    setFeedbackGiven(withinFeedbackWindow(feedbackKey))
  }, [feedbackKey])

  const markFeedbackGiven = () => {
    if (feedbackKey) localStorage.setItem(feedbackKey, String(Date.now()))
    setFeedbackGiven(true)
  }

  // Feedback is no longer a toolbar button. Instead it surfaces ONCE per user as
  // a gentle, delayed prompt on the home screen; closing or submitting it stamps
  // the 3-month window so it won't reappear. Admins are exempt.
  //
  // It must never pop the moment the app opens: we only ask once the user has
  // finished a test or two (TESTS_BEFORE_FEEDBACK), so the request feels earned.
  useEffect(() => {
    if (feedbackGiven || !user || isAdmin || tourActive) return
    if (location.pathname !== '/test-arena') return
    if (getTestsCompleted(user.id) < TESTS_BEFORE_FEEDBACK) return
    const id = window.setTimeout(() => setFeedbackOpen(true), 2500)
    return () => window.clearTimeout(id)
  }, [feedbackGiven, user, isAdmin, tourActive, location.pathname])

  const cycleLang = () => {
    const next = LANG_CYCLE[(LANG_CYCLE.indexOf(lang) + 1) % LANG_CYCLE.length]
    setLang(next)
    // Keep the account preference in sync so the choice persists across devices.
    api.updateProfile({ language: next }).catch(() => {})
  }

  const isActive = (to: string) =>
    to === '/test-arena'
      ? location.pathname === '/test-arena'
      : location.pathname.startsWith(to)

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas bg-brand-radial">
      {!bare && (
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <button
              onClick={() => navigate('/test-arena')}
              className="flex flex-shrink-0 items-center gap-2.5 transition hover:opacity-80"
            >
              <img src="/logo-mark.png" alt="" className="h-9 w-9 flex-shrink-0 object-contain" />
              <span className="font-heading text-base font-semibold tracking-tight text-ink">
                TNPSC <span className="text-brand">Mentors</span>
              </span>
            </button>

            {/* Desktop primary nav - replaces the bottom tab bar on large screens. */}
            <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
              {nav.map(({ to, icon: Icon, key }) => {
                const active = isActive(to)
                return (
                  <button
                    key={to}
                    onClick={() => navigate(to)}
                    aria-current={active}
                    className={[
                      'press focus-ring flex items-center gap-2 rounded-xl px-3.5 py-2 font-heading text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand-soft text-brand-dark'
                        : 'text-ink2 hover:bg-brand-soft/60 hover:text-brand-dark',
                    ].join(' ')}
                  >
                    <Icon size={17} />
                    <span className="tamil">{t(key)}</span>
                    {to === '/admin/reports' && openReports > 0 && (
                      <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-coral px-1 font-heading text-[11px] font-bold text-white">
                        {openReports}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={cycleLang}
                data-tour="lang"
                title={t('chooseLanguage')}
                aria-label={`${t('chooseLanguage')} (${LANG_LABEL[lang]})`}
                className="tamil press rounded-lg bg-brand-soft px-2.5 py-1.5 font-heading text-xs font-semibold text-brand-dark transition hover:bg-tint focus-ring"
              >
                {LANG_LABEL[lang]}
              </button>
              <button
                onClick={toggleTheme}
                title={resolvedTheme === 'dark' ? t('lightMode') : t('darkMode')}
                aria-label={resolvedTheme === 'dark' ? t('lightMode') : t('darkMode')}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink2 transition hover:bg-brand-soft hover:text-brand-dark focus-ring active:scale-90"
              >
                {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {user && <CreditPill />}
              {user && <NotificationBell />}
              {/* Preview toggle (real admins only) - switch between the admin and
                  the student experience. Visible in both modes so it's reversible. */}
              {realIsAdmin && (
                <button
                  onClick={previewAsStudent ? exitStudentPreview : enterStudentPreview}
                  title={previewAsStudent ? t('adminView') : t('studentView')}
                  aria-label={previewAsStudent ? t('adminView') : t('studentView')}
                  aria-pressed={previewAsStudent}
                  className={[
                    'press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-heading text-xs font-semibold focus-ring',
                    previewAsStudent
                      ? 'bg-gold text-white shadow-brand'
                      : 'bg-brand-soft text-brand-dark hover:bg-tint',
                  ].join(' ')}
                >
                  {previewAsStudent ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span className="tamil hidden sm:inline">
                    {previewAsStudent ? t('adminView') : t('studentView')}
                  </span>
                </button>
              )}
              {isSuperAdmin ? (
                <button
                  onClick={() => navigate('/superadmin')}
                  title={t('superadminConsole')}
                  aria-label={t('superadminConsole')}
                  className="press hidden items-center gap-1 rounded-lg bg-brand-gradient px-2.5 py-1.5 font-heading text-xs font-semibold uppercase tracking-wide text-white shadow-brand focus-ring sm:inline-flex"
                >
                  <ShieldCheck size={13} /> {t('superadmin')}
                </button>
              ) : (
                isAdmin && (
                  <span className="hidden items-center gap-1 rounded-lg bg-goldsoft px-2.5 py-1.5 font-heading text-xs font-semibold uppercase tracking-wide text-gold sm:inline-flex">
                    <ShieldCheck size={13} /> {t('admin')}
                  </span>
                )
              )}
              {profile?.full_name && (
                <span
                  title={profile.full_name}
                  className="hidden max-w-[140px] truncate font-body text-sm text-ink2 sm:inline"
                >
                  {profile.full_name}
                </span>
              )}
              <button
                onClick={() => navigate('/profile')}
                title={t('profile')}
                aria-label={t('profile')}
                className={[
                  'grid h-9 w-9 place-items-center overflow-hidden rounded-lg transition focus-ring active:scale-90',
                  location.pathname.startsWith('/profile')
                    ? 'bg-brand text-white'
                    : 'text-ink2 hover:bg-brand-soft hover:text-brand-dark',
                ].join(' ')}
              >
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.full_name}
                  className="grid h-full w-full place-items-center rounded-lg"
                >
                  <User size={18} />
                </Avatar>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Student-preview banner - a clear reminder + one-tap exit below the header
          (the header keeps a compact toggle on every screen size too). */}
      {!bare && previewAsStudent && (
        <div className="border-b border-gold/30 bg-goldsoft">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
            <span className="tamil flex items-center gap-2 font-heading text-xs font-semibold text-gold">
              <Eye size={14} /> {t('viewingAsStudent')}
            </span>
            <button
              onClick={exitStudentPreview}
              className="press tamil inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 font-heading text-xs font-semibold text-white shadow-brand focus-ring"
            >
              <EyeOff size={14} /> {t('exitStudentView')}
            </button>
          </div>
        </div>
      )}

      <main className={bare ? '' : 'pb-24 lg:pb-10'}>{children}</main>

      {/* Admin/superadmin consoles are long, scroll-heavy pages - give content
          managers a quick jump back to the header/tabs. */}
      {!bare && isAdmin && <BackToTopButton />}

      {!bare && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card lg:hidden">
          <div
            className="mx-auto flex max-w-md items-stretch justify-between gap-0.5 px-2 py-1.5"
            style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
          >
            {nav.map(({ to, icon: Icon, short }) => {
              const active = isActive(to)
              return (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  aria-label={t(short)}
                  aria-current={active}
                  className="group focus-ring relative flex min-h-[3rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1"
                >
                  <span
                    className={[
                      'relative grid h-9 w-9 place-items-center rounded-xl transition-all duration-200 group-active:scale-90',
                      active
                        ? 'bg-brand-gradient text-white'
                        : 'text-ink2 group-hover:bg-brand-soft group-hover:text-brand-dark',
                    ].join(' ')}
                  >
                    <Icon size={19} />
                    {to === '/admin/reports' && openReports > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-coral px-0.5 font-heading text-[10px] font-bold text-white">
                        {openReports}
                      </span>
                    )}
                  </span>
                  <span
                    className={[
                      'tamil w-full truncate text-center text-[10px] font-heading font-medium leading-none transition-colors',
                      active ? 'text-brand-dark' : 'text-ink2',
                    ].join(' ')}
                  >
                    {t(short)}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {/* Superadmin popup alerts — chrome screens only, never over a live test. */}
      {!bare && user && <AlertPopup />}

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => {
          // Showing it once is enough - stamp the 3-month window on close so it
          // won't surface again (whether or not the user submitted).
          setFeedbackOpen(false)
          markFeedbackGiven()
        }}
        onSubmitted={markFeedbackGiven}
      />
    </div>
  )
}

/**
 * Header credit meter for free learners: the current balance, coral-tinted when
 * too low to start a test (< 10). Hidden for unlimited (paid/staff) users. Taps
 * through to the profile, where the meter + upgrade options live.
 */
function CreditPill() {
  const navigate = useNavigate()
  const { t } = useT()
  const loaded = useCreditsStore((s) => s.loaded)
  const unlimited = useCreditsStore((s) => s.unlimited)
  const balance = useCreditsStore((s) => s.balance)
  if (!loaded || unlimited) return null
  const low = balance < 10
  return (
    <button
      onClick={() => navigate('/profile')}
      data-tour="credits"
      title={t('creditsTitle')}
      aria-label={`${balance} ${t('creditsWord')}`}
      className={[
        'press focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-heading text-xs font-bold tabular-nums transition',
        low ? 'bg-coralsoft text-coral' : 'bg-brand-soft text-brand-dark hover:bg-tint',
      ].join(' ')}
    >
      <Coins size={14} /> {balance}
    </button>
  )
}
