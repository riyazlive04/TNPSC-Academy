import { describe, it, expect } from 'vitest'
import { submitTest, type SubmitTestInput } from '../lib/submitTest'
import { ATTENDANCE_GATE } from '../store/quizStore'
import type { Question, TestAnswer } from '../types'

// gradeLocally is the client-side grader, reached via submitTest when the test
// is a Thirukkural quiz (category === 'thirukural'); the questions already carry
// correct_answer so there's no server round-trip to mock.

const q = (id: string, correct: Question['correct_answer']): Question => ({
  id,
  category: 'thirukural',
  question_text: `Q${id}`,
  option_a: 'A',
  option_b: 'B',
  option_c: 'C',
  option_d: 'D',
  correct_answer: correct,
})

const ans = (id: string, letter: TestAnswer['selected_answer']): TestAnswer => ({
  question_id: id,
  selected_answer: letter,
  time_spent_seconds: 5,
})

function input(over: Partial<SubmitTestInput> = {}): SubmitTestInput {
  return {
    config: { category: 'thirukural' },
    questions: [],
    answers: {},
    flags: {},
    timeLimitSeconds: 60,
    startedAt: Date.now(),
    ...over,
  }
}

describe('gradeLocally (thirukural client grading)', () => {
  it('scores attempted answers and skips unanswered ones', async () => {
    const questions = [q('1', 'A'), q('2', 'B'), q('3', 'C'), q('4', 'D')]
    const answers = {
      '1': ans('1', 'A'), // correct
      '2': ans('2', 'C'), // wrong
      '3': ans('3', 'C'), // correct
      // '4' skipped
    }
    const r = await submitTest(input({ questions, answers }))
    expect(r.totalQuestions).toBe(4)
    expect(r.attempted).toBe(3)
    expect(r.correct).toBe(2)
    expect(r.scorePercentage).toBe(50) // 2 / 4
    // Skipped question is not in the graded answers map.
    expect(Object.keys(r.answers).sort()).toEqual(['1', '2', '3'])
    expect(r.answers['1'].is_correct).toBe(true)
    expect(r.answers['2'].is_correct).toBe(false)
  })

  it('guards a zero-question test (no divide-by-zero)', async () => {
    const r = await submitTest(input({ questions: [], answers: {} }))
    expect(r.totalQuestions).toBe(0)
    expect(r.attempted).toBe(0)
    expect(r.correct).toBe(0)
    expect(r.scorePercentage).toBe(0)
    expect(r.pdfUnlocked).toBe(false)
  })

  it('unlocks the PDF at the shared ATTENDANCE_GATE, not full attendance', async () => {
    // 4 questions, exactly 1 attempted = 25% = the gate.
    const questions = [q('1', 'A'), q('2', 'B'), q('3', 'C'), q('4', 'D')]
    const r = await submitTest(input({ questions, answers: { '1': ans('1', 'A') } }))
    expect(r.attempted / r.totalQuestions).toBe(ATTENDANCE_GATE)
    expect(r.pdfUnlocked).toBe(true)
  })

  it('keeps the PDF locked below the attendance gate', async () => {
    // 5 questions, 1 attempted = 20% < 25%.
    const questions = ['1', '2', '3', '4', '5'].map((id) => q(id, 'A'))
    const r = await submitTest(input({ questions, answers: { '1': ans('1', 'A') } }))
    expect(r.attempted / r.totalQuestions).toBeLessThan(ATTENDANCE_GATE)
    expect(r.pdfUnlocked).toBe(false)
  })

  it('unlocks on a full-attendance run too', async () => {
    const questions = [q('1', 'A'), q('2', 'B')]
    const r = await submitTest(
      input({ questions, answers: { '1': ans('1', 'A'), '2': ans('2', 'B') } })
    )
    expect(r.attempted).toBe(2)
    expect(r.pdfUnlocked).toBe(true)
  })
})
