import { lazy, Suspense, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Compass, Home } from 'lucide-react'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { warmApi } from './lib/api'
import { isNativeApp } from './lib/nativeAuth'
import { installCopyGuard } from './lib/copyGuard'
import { pageVariants, pageTransition } from './lib/motion'
import ProtectedRoute from './components/Layout/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import SmoothScroll from './components/SmoothScroll'
import UpdatePrompt from './components/UpdatePrompt'
import BackButtonGuard from './components/BackButtonGuard'
import Toaster from './components/UI/Toaster'
import Spinner from './components/UI/Spinner'

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
const PyqGroup2Page = lazy(() => import('./pages/PyqGroup2Page'))
const PyqGroup2SectionPage = lazy(() => import('./pages/PyqGroup2SectionPage'))
const HistoryPeriodsPage = lazy(() => import('./pages/HistoryPeriodsPage'))
const PyqAptitudePage = lazy(() => import('./pages/PyqAptitudePage'))
const SamacheerPage = lazy(() => import('./pages/SamacheerPage'))
const SubjectPracticePage = lazy(() => import('./pages/SubjectPracticePage'))
const CurrentAffairsPage = lazy(() => import('./pages/CurrentAffairsPage'))
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
const SetupPage = lazy(() => import('./pages/SetupPage'))
const ThirukuralQuizPage = lazy(() => import('./pages/ThirukuralQuizPage'))
const DailyPage = lazy(() => import('./pages/DailyPage'))
const BookmarksPage = lazy(() => import('./pages/BookmarksPage'))
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const PolicyPage = lazy(() => import('./pages/PolicyPage'))

/** Every authenticated route. Wrapped in <ProtectedRoute> via the map below. */
const PROTECTED_ROUTES: { path: string; element: ReactElement; role?: 'admin' | 'superadmin' }[] = [
  { path: '/complete-profile', element: <CompleteProfilePage /> },
  { path: '/language', element: <LanguageScreen /> },
  { path: '/test-arena', element: <TestArenaPage /> },
  { path: '/test-arena/pyq', element: <PyqGroupChooserPage /> },
  { path: '/test-arena/pyq/group1', element: <PreviousYearPage /> },
  { path: '/test-arena/pyq/group2', element: <PyqGroup2Page /> },
  { path: '/test-arena/pyq/group2/:section', element: <PyqGroup2SectionPage /> },
  { path: '/test-arena/pyq/history', element: <HistoryPeriodsPage /> },
  { path: '/test-arena/pyq/aptitude', element: <PyqAptitudePage /> },
  { path: '/test-arena/subjects', element: <SubjectPracticePage /> },
  // Samacheer is hidden from the dashboard but its route is kept for direct/admin
  // access (its data currently lives in questions_backup).
  { path: '/test-arena/samacheer', element: <SamacheerPage /> },
  { path: '/test-arena/current-affairs', element: <CurrentAffairsPage /> },
  { path: '/test-arena/aptitude', element: <AptitudePage /> },
  { path: '/test-arena/thirukural', element: <ThirukuralQuizPage /> },
  { path: '/quiz/instructions', element: <QuizInstructionsPage /> },
  { path: '/quiz', element: <QuizPage /> },
  { path: '/admin/questions', element: <AdminQuestionsPage /> },
  { path: '/admin/reports', element: <AdminReportsPage />, role: 'admin' },
  { path: '/result', element: <ResultPage /> },
  { path: '/insights', element: <InsightsPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/materials', element: <MaterialsPage /> },
  { path: '/revision', element: <RevisionPage /> },
  { path: '/mock', element: <MockTestPage /> },
  { path: '/mock/instructions', element: <MockInstructionsPage /> },
  { path: '/mock/quiz', element: <MockQuizPage /> },
  { path: '/setup', element: <SetupPage /> },
  { path: '/daily', element: <DailyPage /> },
  { path: '/bookmarks', element: <BookmarksPage /> },
  { path: '/superadmin', element: <SuperAdminPage />, role: 'superadmin' },
]

export default function App() {
  const init = useAuthStore((s) => s.init)

  // Bootstrap the Supabase session once on mount, and immediately ping the API
  // so a sleeping (Render free) container starts waking in parallel. Also wire
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
  useEffect(() => {
    const prefetch = () => {
      void import('./pages/TestArenaPage')
      void import('./pages/SubjectPracticePage')
      void import('./pages/PreviousYearPage')
      void import('./pages/QuizInstructionsPage')
      void import('./pages/QuizPage')
      void import('./pages/ResultPage')
      void import('./pages/MockTestPage')
    }
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
    <BackButtonGuard />
    <Toaster />
    </>
  )
}

/** The route table, with a native-feeling cross-fade between screens. Keyed on
 * the pathname so AnimatePresence runs an exit→enter on every navigation; honours
 * prefers-reduced-motion by rendering the routes statically. Motion tokens drive
 * the timing (lib/motion). */
function AnimatedRoutes() {
  const location = useLocation()
  const reduce = useReducedMotion()

  const routes = (
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

      {/* Protected */}
      {PROTECTED_ROUTES.map(({ path, element, role }) => (
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

  if (reduce) return routes

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
      >
        {routes}
      </motion.div>
    </AnimatePresence>
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

/** Full-screen fallback shown while a route's lazy chunk is being fetched. */
function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Spinner size={28} />
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
