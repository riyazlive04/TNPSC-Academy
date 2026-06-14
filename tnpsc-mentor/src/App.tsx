import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/Layout/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import Toaster from './components/UI/Toaster'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LanguageScreen from './pages/LanguageScreen'
import TestArenaPage from './pages/TestArenaPage'
import PreviousYearPage from './pages/PreviousYearPage'
import SamacheerPage from './pages/SamacheerPage'
import SubjectPracticePage from './pages/SubjectPracticePage'
import CurrentAffairsPage from './pages/CurrentAffairsPage'
import AptitudePage from './pages/AptitudePage'
import QuizPage from './pages/QuizPage'
import AdminQuestionsPage from './pages/AdminQuestionsPage'
import ResultPage from './pages/ResultPage'
import InsightsPage from './pages/InsightsPage'
import AchievementsPage from './pages/AchievementsPage'
import RevisionPage from './pages/RevisionPage'
import MockTestPage from './pages/MockTestPage'
import SetupPage from './pages/SetupPage'
import DailyPage from './pages/DailyPage'
import BookmarksPage from './pages/BookmarksPage'
import SuperAdminPage from './pages/SuperAdminPage'

/** Every authenticated route. Wrapped in <ProtectedRoute> via the map below. */
const PROTECTED_ROUTES: { path: string; element: ReactElement; role?: 'admin' | 'superadmin' }[] = [
  { path: '/language', element: <LanguageScreen /> },
  { path: '/test-arena', element: <TestArenaPage /> },
  { path: '/test-arena/pyq', element: <PreviousYearPage /> },
  { path: '/test-arena/subjects', element: <SubjectPracticePage /> },
  // Samacheer is hidden from the dashboard but its route is kept for direct/admin
  // access (its data currently lives in questions_backup).
  { path: '/test-arena/samacheer', element: <SamacheerPage /> },
  { path: '/test-arena/current-affairs', element: <CurrentAffairsPage /> },
  { path: '/test-arena/aptitude', element: <AptitudePage /> },
  { path: '/quiz', element: <QuizPage /> },
  { path: '/admin/questions', element: <AdminQuestionsPage /> },
  { path: '/result', element: <ResultPage /> },
  { path: '/insights', element: <InsightsPage /> },
  { path: '/achievements', element: <AchievementsPage /> },
  { path: '/revision', element: <RevisionPage /> },
  { path: '/mock', element: <MockTestPage /> },
  { path: '/setup', element: <SetupPage /> },
  { path: '/daily', element: <DailyPage /> },
  { path: '/bookmarks', element: <BookmarksPage /> },
  { path: '/superadmin', element: <SuperAdminPage />, role: 'superadmin' },
]

export default function App() {
  const init = useAuthStore((s) => s.init)

  // Bootstrap the Supabase session once on mount.
  useEffect(() => {
    init()
  }, [init])

  return (
    <>
    <ScrollToTop />
    <Routes>
      {/* Public landing page — explains the product to logged-out visitors. */}
      <Route path="/" element={<LandingPage />} />
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
    <Toaster />
    </>
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
