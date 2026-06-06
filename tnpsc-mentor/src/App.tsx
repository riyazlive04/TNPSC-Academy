import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/Layout/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LanguageScreen from './pages/LanguageScreen'
import TestArenaPage from './pages/TestArenaPage'
import PreviousYearPage from './pages/PreviousYearPage'
import SamacheerPage from './pages/SamacheerPage'
import CurrentAffairsPage from './pages/CurrentAffairsPage'
import AptitudePage from './pages/AptitudePage'
import QuizPage from './pages/QuizPage'
import AdminQuestionsPage from './pages/AdminQuestionsPage'
import ResultPage from './pages/ResultPage'
import InsightsPage from './pages/InsightsPage'
import RevisionPage from './pages/RevisionPage'
import MockTestPage from './pages/MockTestPage'

export default function App() {
  const init = useAuthStore((s) => s.init)

  // Bootstrap the Supabase session once on mount.
  useEffect(() => {
    init()
  }, [init])

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Protected */}
      <Route
        path="/language"
        element={
          <ProtectedRoute>
            <LanguageScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-arena"
        element={
          <ProtectedRoute>
            <TestArenaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-arena/pyq"
        element={
          <ProtectedRoute>
            <PreviousYearPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-arena/samacheer"
        element={
          <ProtectedRoute>
            <SamacheerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-arena/current-affairs"
        element={
          <ProtectedRoute>
            <CurrentAffairsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-arena/aptitude"
        element={
          <ProtectedRoute>
            <AptitudePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quiz"
        element={
          <ProtectedRoute>
            <QuizPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/questions"
        element={
          <ProtectedRoute>
            <AdminQuestionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/result"
        element={
          <ProtectedRoute>
            <ResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <InsightsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/revision"
        element={
          <ProtectedRoute>
            <RevisionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mock"
        element={
          <ProtectedRoute>
            <MockTestPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
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
