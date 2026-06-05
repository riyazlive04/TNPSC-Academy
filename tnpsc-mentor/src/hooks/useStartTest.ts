import { useNavigate } from 'react-router-dom'
import type { QuizConfig } from '../types'
import { useAuth } from './useAuth'

/**
 * Returns a function that begins a test session for a given config. Regular
 * users go to the timed quiz engine (`/quiz`); admins follow the exact same
 * selection flow but land on the full question-bank view (`/admin/questions`)
 * instead of attending the test.
 */
export function useStartTest() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  return (config: QuizConfig) => {
    const target = isAdmin ? '/admin/questions' : '/quiz'
    navigate(target, { state: config })
  }
}
