import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnswerLetter, Question, QuizConfig } from '../types'

/**
 * Dedicated persisted store for the proctored mock-test flow (MockQuizPage).
 * Mirrors quizStore's resume-after-refresh pattern: config + questions +
 * answers + marked/visited + page + startedAt are persisted to localStorage,
 * while the live countdown is NOT - it is recomputed from `startedAt` so a
 * closed tab doesn't "pause" the clock.
 */
interface MockQuizState {
  config: QuizConfig | null
  questions: Question[]
  answers: Record<string, AnswerLetter>
  marked: Record<string, boolean>
  visited: Record<number, boolean>
  page: number
  startedAt: number // Date.now()

  /** Begin a fresh mock session (called once questions have loaded). */
  start: (config: QuizConfig, questions: Question[]) => void
  /** Clear the persisted session (on submit / abandon). */
  reset: () => void

  setAnswers: (answers: Record<string, AnswerLetter>) => void
  setMarked: (marked: Record<string, boolean>) => void
  setVisited: (visited: Record<number, boolean>) => void
  setPage: (page: number) => void
}

const initialState = {
  config: null as QuizConfig | null,
  questions: [] as Question[],
  answers: {} as Record<string, AnswerLetter>,
  marked: {} as Record<string, boolean>,
  visited: { 0: true } as Record<number, boolean>,
  page: 0,
  startedAt: 0,
}

export const useMockQuizStore = create<MockQuizState>()(
  persist(
    (set) => ({
      ...initialState,

      start: (config, questions) =>
        set({
          config,
          questions,
          answers: {},
          marked: {},
          visited: { 0: true },
          page: 0,
          startedAt: Date.now(),
        }),

      reset: () => set({ ...initialState }),

      setAnswers: (answers) => set({ answers }),
      setMarked: (marked) => set({ marked }),
      setVisited: (visited) => set({ visited }),
      setPage: (page) => set({ page }),
    }),
    {
      name: 'tnpsc-mentor-mock-quiz',
      // Persist enough to resume an in-progress mock across a refresh. The
      // remaining time is recomputed from `startedAt` (not persisted) so a
      // closed tab doesn't "pause" the clock.
      partialize: (s) => ({
        config: s.config,
        questions: s.questions,
        answers: s.answers,
        marked: s.marked,
        visited: s.visited,
        page: s.page,
        startedAt: s.startedAt,
      }),
    }
  )
)
