import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Compass, Home, Loader2, Wrench } from 'lucide-react'
import {
  useAuthStore,
  selectIsAdmin,
  selectIsSuperAdmin,
  selectIsTelecaller,
} from './store/authStore'
import { useAuthConfigStore } from './store/authConfigStore'
import { useThemeStore } from './store/themeStore'
import { useUpsellStore } from './store/upsellStore'
import { api, warmApi } from './lib/api'
import { installCopyGuard } from './lib/copyGuard'
import { trackPageView } from './lib/tracking'
import { pageVariants } from './lib/motion'
import { useT } from './lib/i18n'
import AppLayout from './components/Layout/AppLayout'
import ProtectedRoute from './components/Layout/ProtectedRoute'
import { prefetchRoutes, PREFETCH_ON_BOOT } from './lib/routePrefetch'
import { useNativeBootstrap } from './hooks/useNativeBootstrap'
import ScrollToTop from './components/ScrollToTop'
import SmoothScroll from './components/SmoothScroll'
import UpdatePrompt from './components/UpdatePrompt'
import BackButtonGuard from './components/BackButtonGuard'
import OfflineBanner from './components/OfflineBanner'
import { getConsent } from './lib/cookieConsent'
import PushPrimer from './components/Onboarding/PushPrimer'
import Toaster from './components/UI/Toaster'
import LogoLoader from './components/UI/LogoLoader'

// The forced-upsell overlay ships in its own chunk (it drags in the purchase
// cards + Razorpay plumbing) and is only fetched the first time a paywall
// actually opens it - never on app boot.
const UpsellModal = lazy(() => import('./components/UI/UpsellModal'))

/** Mounts the upsell chunk on demand: nothing rendered (or downloaded) until
 * some gate calls upsell.credits()/premium()/bundle(). */
function UpsellOutlet() {
  const open = useUpsellStore((s) => s.open)
  if (!open) return null
  return (
    <Suspense fallback={null}>
      <UpsellModal />
    </Suspense>
  )
}

// Route-based code splitting: each page ships as its own chunk and is fetched
// only when the user navigates to it, instead of bundling all ~30 pages into
// the initial download. This is the main lever on first-load weight.
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage'))
const LanguageScreen = lazy(() => import('./pages/LanguageScreen'))
const WelcomeIntroPage = lazy(() => import('./pages/WelcomeIntroPage'))
const TestArenaPage = lazy(() => import('./pages/TestArenaPage'))
const PyqGroupChooserPage = lazy(() => import('./pages/PyqGroupChooserPage'))
const PreviousYearPage = lazy(() => import('./pages/PreviousYearPage'))
const PyqGroupPage = lazy(() => import('./pages/PyqGroupPage'))
const PyqSectionPage = lazy(() => import('./pages/PyqSectionPage'))
const HistoryPeriodsPage = lazy(() => import('./pages/HistoryPeriodsPage'))
const PyqAptitudePage = lazy(() => import('./pages/PyqAptitudePage'))
const SamacheerPage = lazy(() => import('./pages/SamacheerPage'))
const SubjectPracticePage = lazy(() => import('./pages/SubjectPracticePage'))
const CurrentAffairsPage = lazy(() => import('./pages/CurrentAffairsPage'))
const CaQuestionsPage = lazy(() => import('./pages/CaQuestionsPage'))
const AptitudePage = lazy(() => import('./pages/AptitudePage'))
const QuizInstructionsPage = lazy(() => import('./pages/QuizInstructionsPage'))
const QuizPage = lazy(() => import('./pages/QuizPage'))
const AdminQuestionsPage = lazy(() => import('./pages/AdminQuestionsPage'))
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'))
const ResultPage = lazy(() => import('./pages/ResultPage'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'))
const RevisionPage = lazy(() => import('./pages/RevisionPage'))
const MockTestPage = lazy(() => import('./pages/MockTestPage'))
const MockInstructionsPage = lazy(() => import('./pages/MockInstructionsPage'))
const MockQuizPage = lazy(() => import('./pages/MockQuizPage'))
const TestSeriesPage = lazy(() => import('./pages/TestSeriesPage'))
const VettriPage = lazy(() => import('./pages/VettriPage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const SetupPage = lazy(() => import('./pages/SetupPage'))
const ThirukuralQuizPage = lazy(() => import('./pages/ThirukuralQuizPage'))
const DailyPage = lazy(() => import('./pages/DailyPage'))
const FlashcardDeck = lazy(() => import('./pages/FlashcardDeck'))
const BookmarksPage = lazy(() => import('./pages/BookmarksPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'))
const CrmPage = lazy(() => import('./pages/CrmPage'))
const RankBoosterLandingPage = lazy(() => import('./pages/RankBoosterLandingPage'))
const PolicyPage = lazy(() => import('./pages/PolicyPage'))

interface RouteDef {
  path: string
  element: ReactElement
  role?: 'admin' | 'superadmin' | 'crm'
}

/**
 * Authenticated routes that render inside the app chrome (header + tab bar).
 * The shell is mounted ONCE for all of them (see AppShell) — switching tabs
 * swaps only the content, so the nav never unmounts, re-renders its whole tree
 * or flashes. Every page here renders its own content directly; none of them
 * mount AppLayout themselves.
 */
const SHELL_ROUTES: RouteDef[] = [
  { path: '/test-arena', element: <TestArenaPage /> },
  { path: '/test-arena/pyq', element: <PyqGroupChooserPage /> },
  { path: '/test-arena/pyq/group1', element: <PreviousYearPage /> },
  { path: '/test-arena/pyq/history', element: <HistoryPeriodsPage /> },
  { path: '/test-arena/pyq/aptitude', element: <PyqAptitudePage /> },
  // The section-wise groups (group2 | group4) share one pair of pages, driven by
  // PYQ_GROUPS. Declared after the static /pyq/* routes above; React Router ranks
  // static segments over dynamic ones, so those keep winning. An unknown :group
  // redirects to the chooser.
  { path: '/test-arena/pyq/:group', element: <PyqGroupPage /> },
  { path: '/test-arena/pyq/:group/:section', element: <PyqSectionPage /> },
  { path: '/test-arena/subjects', element: <SubjectPracticePage /> },
  // Samacheer is hidden from the dashboard but its route is kept for direct/admin
  // access (its data currently lives in questions_backup).
  { path: '/test-arena/samacheer', element: <SamacheerPage /> },
  { path: '/test-arena/current-affairs', element: <CurrentAffairsPage /> },
  { path: '/test-arena/ca-questions', element: <CaQuestionsPage /> },
  { path: '/test-arena/aptitude', element: <AptitudePage /> },
  { path: '/test-arena/thirukural', element: <ThirukuralQuizPage /> },
  { path: '/quiz/instructions', element: <QuizInstructionsPage /> },
  { path: '/admin/questions', element: <AdminQuestionsPage /> },
  { path: '/admin/reports', element: <AdminReportsPage />, role: 'admin' },
  { path: '/result', element: <ResultPage /> },
  { path: '/insights', element: <InsightsPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/materials', element: <MaterialsPage /> },
  { path: '/revision', element: <RevisionPage /> },
  { path: '/mock', element: <MockTestPage /> },
  { path: '/mock/instructions', element: <MockInstructionsPage /> },
  { path: '/test-series', element: <TestSeriesPage /> },
  { path: '/vettri', element: <VettriPage /> },
  { path: '/setup', element: <SetupPage /> },
  { path: '/daily', element: <DailyPage /> },
  { path: '/bookmarks', element: <BookmarksPage /> },
  { path: '/messages', element: <MessagesPage /> },
  { path: '/superadmin', element: <SuperAdminPage />, role: 'superadmin' },
]

/**
 * Authenticated routes that own the whole viewport — the live test screens and
 * the one-off setup steps. No chrome, and no cross-fade either: a test must
 * appear the instant it is ready.
 */
const BARE_ROUTES: RouteDef[] = [
  { path: '/complete-profile', element: <CompleteProfilePage /> },
  { path: '/language', element: <LanguageScreen /> },
  // The first-run intro slides ("what's in the app"): own the whole viewport so
  // nothing of the app is visible behind them until the walkthrough is done.
  { path: '/welcome', element: <WelcomeIntroPage /> },
  { path: '/quiz', element: <QuizPage /> },
  { path: '/mock/quiz', element: <MockQuizPage /> },
  // The flashcard viewer hijacks the screen the way a test does — the swipe
  // gesture needs the full viewport, and the tab bar would sit under the thumb.
  { path: '/flashcards/:deckId', element: <FlashcardDeck /> },
  { path: '/payment-success', element: <PaymentSuccessPage /> },
  // The telecaller lead desk owns the whole viewport: its users are staff, not
  // aspirants, so the student header and tab bar would be dead weight (and a
  // pile of tiles they have no access to). Its own chrome ships inside the page.
  { path: '/crm', element: <CrmPage />, role: 'crm' },
]

export default function App() {
  const init = useAuthStore((s) => s.init)

  // Native-only launch work: edge-to-edge chrome, splash dismissal, recovery of
  // any purchase the store charged for but our server never recorded, push-token
  // refresh, and deep-link handling. No-ops entirely on the web build.
  useNativeBootstrap()

  // Bootstrap the Supabase session once on mount, and warm the API connection
  // in parallel (DNS/TLS pre-connect — the VPS API is always-on). Also wire
  // the theme store (re-apply + listen for OS light/dark changes).
  useEffect(() => {
    useThemeStore.getState().init()
    warmApi()
    init()
    void useAuthConfigStore.getState().init()
    // Block copy/cut/paste/long-press selection app-wide in the installed app.
    installCopyGuard()
    // Cookie/tracker consent is auto-accepted (no banner) — this both reads
    // and, on a first visit, records the choice and kicks off GTM/Clarity/Pixel.
    getConsent()
  }, [init])

  // Warm the chunks for the most-likely next screens during browser idle time,
  // so moving between pages is instant instead of hitting the Suspense spinner.
  // Vite dedupes these against the lazy() loaders above - no double download.
  // Every nav tab is covered, because a tab tap is the navigation that must
  // never wait on a download (routePrefetch also warms one on tap/hover).
  useEffect(() => {
    const prefetch = () => prefetchRoutes(PREFETCH_ON_BOOT)
    const ric = window.requestIdleCallback
    if (ric) {
      const id = ric(prefetch)
      return () => window.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(prefetch, 1500)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <>
    <ScrollToTop />
    <SmoothScroll />
    <Suspense fallback={<PageLoader />}>
      <AnimatedRoutes />
    </Suspense>
    <UpdatePrompt />
    <OfflineBanner />
    <BackButtonGuard />
    <PushPrimer />
    <Toaster />
    <UpsellOutlet />
    </>
  )
}

/**
 * The persistent app shell. Mounted once for every chrome route, so the header
 * and tab bar survive navigation: only the content inside cross-fades. That is
 * what makes a tab tap feel instant — nothing in the chrome unmounts, refetches
 * or re-animates.
 */
function AppShell() {
  return (
    <AppLayout>
      {/* A Suspense boundary INSIDE the shell: when a page's chunk still has to
          be fetched, only the content area waits — the chrome stays on screen
          instead of the whole app dropping to a full-screen loader. */}
      <Suspense fallback={<ContentLoader />}>
        <AnimatedOutlet />
      </Suspense>
    </AppLayout>
  )
}

/** The matched child route, cross-faded on change. `useOutlet()` (not <Outlet/>)
 * is what makes this correct: it hands us the element for the CURRENT match, so
 * the outgoing screen AnimatePresence is still holding keeps rendering its own
 * content instead of flipping to the incoming page mid-exit. */
function AnimatedOutlet() {
  const location = useLocation()
  const reduce = useReducedMotion()
  const outlet = useOutlet()

  if (reduce) return outlet

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}

// Always reachable even while maintenance mode is on — an admin has to be
// able to get to /login to prove their role (see MaintenancePage's own link
// there too). Kept deliberately narrow: /register stays gated, since new
// signups shouldn't land mid-maintenance.
const MAINTENANCE_EXEMPT_PATHS = new Set(['/login', '/forgot-password', '/reset-password'])

/** The route table. Chrome routes are nested under the shell (which owns the
 * transition); immersive screens render straight, with no animation at all. */
function AnimatedRoutes() {
  const location = useLocation()
  const maintenanceMode = useAuthConfigStore((s) => s.maintenanceMode)
  const authLoading = useAuthStore((s) => s.loading)
  const realIsAdmin = useAuthStore(selectIsAdmin)
  const realIsSuperAdmin = useAuthStore(selectIsSuperAdmin)
  const realIsTelecaller = useAuthStore(selectIsTelecaller)

  // SPA page-view tracking: GTM/GA4/Meta only fire a pageview on the initial
  // HTML load, so every client-side route change here must be reported by hand.
  // Keyed on the full path+search so each navigation pushes exactly one event.
  useEffect(() => {
    trackPageView(location.pathname + location.search)
  }, [location.pathname, location.search])

  // Real (unmasked) role — "preview as student" must never lock an admin out
  // of their own maintenance window. !authLoading guards the moment right
  // after a real admin's session bootstraps, so they don't flash this page.
  // Telecallers are exempt too, but only ON the desk: maintenance closes the
  // student app, and the lead desk is a separate internal tool whose leads keep
  // arriving throughout a deploy (the API gate mirrors this — see
  // middleware/maintenance.ts).
  if (
    maintenanceMode &&
    !authLoading &&
    !realIsAdmin &&
    !realIsSuperAdmin &&
    !(realIsTelecaller && location.pathname === '/crm') &&
    !MAINTENANCE_EXEMPT_PATHS.has(location.pathname)
  ) {
    return <MaintenancePage />
  }

  return (
    <Routes location={location}>
      {/* Root is auth-aware: logged-in users go straight to the app, everyone
          else lands on /login. The marketing landing page is bypassed. */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Standalone public enrollment page for the Group II/IIA Rank Booster
          test series (marketing/ad landing target) — purchasable directly
          once signed in, or via sign-up-then-return for a brand-new visitor. */}
      <Route path="/rank-booster" element={<RankBoosterLandingPage />} />

      {/* The shareable pay link for the ₹399 Group 1 Mock Test Pack. Renders
          THIS page with the confirm sheet already open over it, rather than a
          page of its own: a buyer handed a bare payment card has nothing to
          judge the offer against, where the landing page behind the sheet is
          the pitch. Two paths because the link is handed out in both shapes;
          both are real routes, not redirects, so a buyer who has to sign up
          mid-checkout returns to the exact URL they were sent
          (MOCK_PACK_BUY_PATHS in lib/authRouting). */}
      <Route path="/mock-test-pack" element={<RankBoosterLandingPage />} />
      <Route path="/rank-booster/mock-test-pack" element={<RankBoosterLandingPage />} />

      {/* The dedicated, self-describing link for the ₹1,249 Group II/IIA test
          series — the same page as /rank-booster, but named for the exam it
          sells rather than the internal product name, opened on its ₹1,249
          price banner with the confirm sheet already up. Two paths for the
          same reason the mock-pack link has two (RANK_BOOSTER_BUY_PATHS in
          lib/authRouting). */}
      <Route path="/group-2-test-series" element={<RankBoosterLandingPage />} />
      <Route path="/rank-booster/group-2-test-series" element={<RankBoosterLandingPage />} />

      {/* Public policy pages (linked from the landing footer) */}
      <Route path="/privacy" element={<PolicyPage slug="privacy" />} />
      <Route path="/guidelines" element={<PolicyPage slug="guidelines" />} />
      <Route path="/payment-policy" element={<PolicyPage slug="payment" />} />
      <Route path="/refund-policy" element={<PolicyPage slug="refund" />} />
      {/* Google Play's User Data policy requires a PUBLIC, no-install-needed URL
          where account deletion can be requested. This route is the value that
          goes in the Play Console Data safety form. */}
      <Route path="/delete-account" element={<PolicyPage slug="delete-account" />} />

      {/* Protected, inside the persistent chrome */}
      <Route element={<AppShell />}>
        {SHELL_ROUTES.map(({ path, element, role }) => (
          <Route
            key={path}
            path={path}
            element={<ProtectedRoute role={role}>{element}</ProtectedRoute>}
          />
        ))}
      </Route>

      {/* Protected, full-viewport */}
      {BARE_ROUTES.map(({ path, element, role }) => (
        <Route
          key={path}
          path={path}
          element={<ProtectedRoute role={role}>{element}</ProtectedRoute>}
        />
      ))}

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

/** Root path "/": send authenticated users straight into the app; everyone else
 * goes straight to the login screen. Waits for the initial session bootstrap so
 * a logged-in user isn't bounced through /login on a hard refresh.
 *
 * The public marketing / APK-download landing page used to sit here for
 * logged-out web visitors. It is now bypassed on every platform — the root URL
 * IS the auth portal, with no intermediate screen — so src/pages/LandingPage.tsx
 * is kept in the tree but no longer routed anywhere (and its lazy chunk is never
 * fetched). Restoring it is one route away. */
function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const isTelecaller = useAuthStore(selectIsTelecaller)
  if (loading) return <PageLoader />
  // Telecallers have no arena — send them straight to the desk rather than
  // through a redirect the ProtectedRoute would have to undo.
  if (user) return <Navigate to={isTelecaller ? '/crm' : '/test-arena'} replace />
  return <Navigate to="/login" replace />
}

/** Full-screen fallback — only for screens that own the whole viewport (auth,
 * landing, live tests) and for the initial boot. */
function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <LogoLoader size={64} />
    </div>
  )
}

/** In-shell fallback: fills the content area only, so the header and tab bar
 * stay put while a page chunk arrives. Sized to roughly a screen so the layout
 * doesn't collapse and bounce when the page lands. */
function ContentLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <LogoLoader size={56} />
    </div>
  )
}

/** Full-screen page shown to non-admins while superadmin-controlled
 * maintenance mode is on (see AnimatedRoutes' gate above). */
function MaintenancePage() {
  const { t } = useT()
  const [retrying, setRetrying] = useState(false)

  const retry = async () => {
    setRetrying(true)
    try {
      const settings = await api.appSettings()
      useAuthConfigStore.setState({ maintenanceMode: settings.maintenance_mode })
    } catch {
      // Stay on this screen either way — the button just stops spinning.
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-5 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-hero bg-tint-violet">
        <Wrench size={30} className="text-primary" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {t('maintenanceTitle')}
        </h1>
        <p className="mx-auto mt-2 max-w-xs font-body text-sm leading-relaxed text-muted">
          {t('maintenanceBody')}
        </p>
      </div>
      <button
        onClick={retry}
        disabled={retrying}
        className="btn-brand flex items-center gap-2 px-6 py-3 text-sm disabled:opacity-60"
      >
        {retrying && <Loader2 size={16} className="animate-spin" />}
        {t('retry')}
      </button>
      <Link to="/login" className="font-body text-xs text-muted underline underline-offset-2">
        {t('maintenanceAdminSignIn')}
      </Link>
    </div>
  )
}

function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-5 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-hero bg-tint-violet">
        <Compass size={30} className="text-primary" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Page not found</h1>
        <p className="mx-auto mt-2 max-w-xs font-body text-sm leading-relaxed text-muted">
          The page you're looking for doesn't exist or may have moved.
        </p>
      </div>
      <button onClick={() => navigate('/test-arena')} className="btn-brand px-6 py-3 text-sm">
        <Home size={16} /> Go to Home
      </button>
    </div>
  )
}
