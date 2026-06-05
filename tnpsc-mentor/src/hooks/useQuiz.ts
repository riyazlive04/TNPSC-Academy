import { useQuizStore } from '../store/quizStore'

/**
 * Thin wrapper around the quiz store so components can read the current
 * question + derived progress without re-subscribing to the whole store.
 */
export function useQuiz() {
  const questions = useQuizStore((s) => s.questions)
  const currentIndex = useQuizStore((s) => s.currentIndex)
  const answers = useQuizStore((s) => s.answers)
  const flags = useQuizStore((s) => s.flags)
  const totalTimeLeft = useQuizStore((s) => s.totalTimeLeft)
  const config = useQuizStore((s) => s.config)

  const currentQuestion = questions[currentIndex] ?? null
  const attempted = Object.keys(answers).length
  const total = questions.length
  const progressPct = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0
  const attemptedPct = total > 0 ? Math.round((attempted / total) * 100) : 0

  return {
    questions,
    currentIndex,
    currentQuestion,
    answers,
    flags,
    totalTimeLeft,
    config,
    attempted,
    total,
    progressPct,
    attemptedPct,
  }
}
