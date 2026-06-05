import { create } from 'zustand'
import type { AnswerLetter, Question, QuizConfig, TestAnswer } from '../types'

export const SECONDS_PER_QUESTION = 45
export const MIN_SECONDS_PER_QUESTION = 15
export const ATTENDANCE_GATE = 0.8 // 80%

interface QuizState {
  config: QuizConfig | null
  questions: Question[]
  currentIndex: number
  answers: Record<string, TestAnswer>
  flags: Record<string, boolean>
  questionStartTime: number // Date.now() when the current question was shown
  totalTimeLeft: number // seconds remaining for whole test
  timeLimitSeconds: number
  sessionId: string | null
  isSubmitting: boolean
  startedAt: number // Date.now()

  // setup
  initSession: (config: QuizConfig, questions: Question[]) => void
  reset: () => void

  // navigation
  goTo: (index: number) => void
  next: () => void
  prev: () => void

  // answering / flagging
  selectAnswer: (questionId: string, letter: AnswerLetter) => void
  toggleFlag: (questionId: string) => void

  // timing
  tick: () => void
  markQuestionStart: () => void

  // session id + submitting
  setSessionId: (id: string) => void
  setSubmitting: (v: boolean) => void

  // derived
  attemptedCount: () => number
  correctCount: () => number
}

const initialState = {
  config: null as QuizConfig | null,
  questions: [] as Question[],
  currentIndex: 0,
  answers: {} as Record<string, TestAnswer>,
  flags: {} as Record<string, boolean>,
  questionStartTime: 0,
  totalTimeLeft: 0,
  timeLimitSeconds: 0,
  sessionId: null as string | null,
  isSubmitting: false,
  startedAt: 0,
}

export const useQuizStore = create<QuizState>((set, get) => ({
  ...initialState,

  initSession: (config, questions) => {
    const limit = Math.max(questions.length, 1) * SECONDS_PER_QUESTION
    set({
      config,
      questions,
      currentIndex: 0,
      answers: {},
      flags: {},
      totalTimeLeft: limit,
      timeLimitSeconds: limit,
      sessionId: null,
      isSubmitting: false,
      questionStartTime: nowSafe(),
      startedAt: nowSafe(),
    })
  },

  reset: () => set({ ...initialState }),

  goTo: (index) => {
    const { questions } = get()
    if (index < 0 || index >= questions.length) return
    set({ currentIndex: index, questionStartTime: nowSafe() })
  },

  next: () => {
    const { currentIndex, questions } = get()
    if (currentIndex + 1 < questions.length) {
      set({ currentIndex: currentIndex + 1, questionStartTime: nowSafe() })
    }
  },

  prev: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1, questionStartTime: nowSafe() })
    }
  },

  selectAnswer: (questionId, letter) => {
    const { questions, answers, questionStartTime } = get()
    const q = questions.find((x) => x.id === questionId)
    if (!q) return
    const elapsed = Math.round((nowSafe() - questionStartTime) / 1000)
    const prior = answers[questionId]
    const answer: TestAnswer = {
      question_id: questionId,
      selected_answer: letter,
      is_correct: letter === q.correct_answer,
      // Keep the time recorded on the first selection for this question.
      time_spent_seconds: prior ? prior.time_spent_seconds : elapsed,
      flagged: get().flags[questionId] ?? false,
    }
    set({ answers: { ...answers, [questionId]: answer } })
  },

  toggleFlag: (questionId) => {
    const { flags } = get()
    set({ flags: { ...flags, [questionId]: !flags[questionId] } })
  },

  tick: () => {
    const { totalTimeLeft } = get()
    if (totalTimeLeft > 0) set({ totalTimeLeft: totalTimeLeft - 1 })
  },

  markQuestionStart: () => set({ questionStartTime: nowSafe() }),

  setSessionId: (id) => set({ sessionId: id }),
  setSubmitting: (v) => set({ isSubmitting: v }),

  attemptedCount: () => Object.keys(get().answers).length,

  correctCount: () =>
    Object.values(get().answers).filter((a) => a.is_correct).length,
}))

// `Date.now()` is fine in the browser runtime; wrapped for clarity / testability.
function nowSafe(): number {
  return Date.now()
}
