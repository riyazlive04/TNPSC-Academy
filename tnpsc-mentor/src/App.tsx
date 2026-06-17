import { lazy, Suspense, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { warmApi } from './lib/api'
import ProtectedRoute from './components/Layout/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import Toaster from './components/UI/Toaster'
import Spinner from './components/UI/Spinner'

// Route-based code splitting: each page ships as its own chunk and is fetched
// only when the user navigates to it, instead of bundling all ~30 pages into
// the initial download. This is the main lever on first-load weight.
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const LanguageScreen = lazy(() => import('./pages/LanguageScreen'))
const TestArenaPage = lazy(() => import('./pages/TestArenaPage'))
const PreviousYearPage = lazy(() => import('./pages/PreviousYearPage'))
const HistoryPeriodsPage = lazy(() => import('./pages/HistoryPeriodsPage'))
const SamacheerPage = lazy(() => import('./pages/SamacheerPage'))
const SubjectPracticePage = lazy(() => import('./pages/SubjectPracticePage'))
const CurrentAffairsPage = lazy(() => import('./pages/CurrentAffairsPage'))
const AptitudePage = lazy(() => import('./pages/AptitudePage'))
const QuizInstructionsPage = lazy(() => import('./pages/QuizInstructionsPage'))
const QuizPage = lazy(() => import('./pages/QuizPage'))
const AdminQuestionsPage = lazy(() => import('./pages/AdminQuestionsPage'))
const ResultPage = lazy(() => import('./pages/ResultPage'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const RevisionPage = lazy(() => import('./pages/RevisionPage'))
const MockTestPage = lazy(() => import('./pages/MockTestPage'))
const MockInstructionsPage = lazy(() => import('./pages/MockInstructionsPage'))
const MockQuizPage = lazy(() => import('./pages/MockQuizPage'))
const SetupPage = lazy(() => import('./pages/SetupPage'))
const DailyPage = lazy(() => import('./pages/DailyPage'))
const BookmarksPage = lazy(() => import('./pages/BookmarksPage'))
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'))

/** Every authenticated route. Wrapped in <ProtectedRoute> via the map below. */
const PROTECTED_ROUTES: { path: string; element: ReactElement; role?: 'admin' | 'superadmin' }[] = [
  { path: '/language', element: <LanguageScreen /> },
  { path: '/test-arena', element: <TestArenaPage /> },
  { path: '/test-arena/pyq', element: <PreviousYearPage /> },
  { path: '/test-arena/pyq/history', element: <HistoryPeriodsPage /> },
  { path: '/test-arena/subjects', element: <SubjectPracticePage /> },
  // Samacheer is hidden from the dashboard but its route is kept for direct/admin
  // access (its data currently lives in questions_backup).
  { path: '/test-arena/samacheer', element: <SamacheerPage /> },
  { path: '/test-arena/current-affairs', element: <CurrentAffairsPage /> },
  { path: '/test-arena/aptitude', element: <AptitudePage /> },
  { path: '/quiz/instructions', element: <QuizInstructionsPage /> },
  { path: '/quiz', element: <QuizPage /> },
  { path: '/admin/questions', element: <AdminQuestionsPage /> },
  { path: '/result', element: <ResultPage /> },
  { path: '/insights', element: <InsightsPage /> },
  { path: '/profile', element: <ProfilePage /> },
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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Root is auth-aware: logged-in users go to the app, everyone else to
            login. The marketing landing page is no longer in the flow. */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

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
    </Suspense>
    <Toaster />
    </>
  )
}

/** Root path "/": send authenticated users into the app, others to login.
 * Waits for the initial session bootstrap so a logged-in user isn't flashed the
 * login screen on a hard refresh. */
function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  if (loading) return <PageLoader />
  return <Navigate to={user ? '/test-arena' : '/login'} replace />
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-primary px-4 text-center">
      <h1 className="font-heading text-5xl font-bold text-accent">404</h1>
      <p className="font-body text-white/70">This page could not be found.</p>
      <button
        onClick={() => navigate('/test-arena')}
        className="rounded-full bg-accent px-6 py-2.5 font-heading font-bold uppercase text-navytext"
      >
        Go to Test Arena
      </button>
    </div>
  )
}
