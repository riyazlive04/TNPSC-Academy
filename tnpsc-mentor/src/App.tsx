import { lazy, Suspense, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useNavigate, useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Compass, Home } from 'lucide-react'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { useUpsellStore } from './store/upsellStore'
import { warmApi } from './lib/api'
import { isNativeApp } from './lib/nativeAuth'
import { installCopyGuard } from './lib/copyGuard'
import { trackPageView } from './lib/tracking'
import { pageVariants } from './lib/motion'
import AppLayout from './components/Layout/AppLayout'
import ProtectedRoute from './components/Layout/ProtectedRoute'
import { prefetchRoutes, PREFETCH_ON_BOOT } from './lib/routePrefetch'
import { useNativeBootstrap } from './hooks/useNativeBootstrap'
import ScrollToTop from './components/ScrollToTop'
import SmoothScroll from './components/SmoothScroll'
import UpdatePrompt from './components/UpdatePrompt'
import BackButtonGuard from './components/BackButtonGuard'
import OfflineBanner from './components/OfflineBanner'
import CookieBanner from './components/CookieBanner'
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
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage'))
const LanguageScreen = lazy(() => import('./pages/LanguageScreen'))
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
const BookmarksPage = lazy(() => import('./pages/BookmarksPage'))
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const PolicyPage = lazy(() => import('./pages/PolicyPage'))

interface RouteDef {
  path: string
  element: ReactElement
  role?: 'admin' | 'superadmin'
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
  { path: '/quiz', element: <QuizPage /> },
  { path: '/mock/quiz', element: <MockQuizPage /> },
  { path: '/payment-success', element: <PaymentSuccessPage /> },
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
    // Block copy/cut/paste/long-press selection app-wide in the installed app.
    installCopyGuard()
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
    <CookieBanner />
    <BackButtonGuard />
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

/** The route table. Chrome routes are nested under the shell (which owns the
 * transition); immersive screens render straight, with no animation at all. */
function AnimatedRoutes() {
  const location = useLocation()

  // SPA page-view tracking: GTM/GA4/Meta only fire a pageview on the initial
  // HTML load, so every client-side route change here must be reported by hand.
  // Keyed on the full path+search so each navigation pushes exactly one event.
  useEffect(() => {
    trackPageView(location.pathname + location.search)
  }, [location.pathname, location.search])

  return (
    <Routes location={location}>
      {/* Root is auth-aware: logged-in users go straight to the app, logged-out
          web visitors see the public marketing/APK-download landing page. */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

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

/** Root path "/": send authenticated users straight into the app; show the
 * public landing page to logged-out web visitors. Waits for the initial session
 * bootstrap so a logged-in user isn't flashed the landing page on a hard refresh.
 *
 * The landing page is the public marketing / APK-download page - it makes no
 * sense inside the installed app, so the native build skips it entirely and
 * sends logged-out users straight to the login screen. (LandingPage is lazily
 * imported, so its chunk is never even fetched in the APK.) */
function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  if (loading) return <PageLoader />
  if (user) return <Navigate to="/test-arena" replace />
  if (isNativeApp()) return <Navigate to="/login" replace />
  return <LandingPage />
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

function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-5 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-hero bg-tint-violet">
        <Compass size={30} className="text-primary" />
      </span>
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">Page not found</h1>
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
