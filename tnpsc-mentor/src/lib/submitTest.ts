import { api } from './api'
import { ATTENDANCE_GATE } from '../store/quizStore'
import type {
  GradedResult,
  Question,
  QuizConfig,
  ResultPayload,
  SubmitResult,
  TestAnswer,
} from '../types'

/** Everything the grader needs, snapshotted from the quiz store at submit time. */
export interface SubmitTestInput {
  config: QuizConfig
  questions: Question[]
  answers: Record<string, TestAnswer>
  flags: Record<string, boolean>
  timeLimitSeconds: number
  /** Date.now() when the test started - used for accurate wall-clock timing. */
  startedAt: number
}

/**
 * Grades a finished test on the server and assembles the result payload for the
 * Result page. The server (`submit_test` RPC) is the sole grader - scores can't
 * be forged client-side, and gated explanations are only returned when the
 * attendance gate (>=25% attempted) unlocks them. Throws on any transport/
 * grading failure so the
 * caller can offer a retry.
 */
export async function submitTest(input: SubmitTestInput): Promise<ResultPayload> {
  const { config, questions, answers, flags, timeLimitSeconds, startedAt } = input

  // Accurate wall-clock time (survives refresh; no off-by-one).
  const timeTaken = Math.max(0, Math.round((Date.now() - startedAt) / 1000))

  // Thirukkural is a client-side bank — grade in the browser (the questions
  // already carry their correct_answer) instead of calling the server grader.
  if (config.category === 'thirukural') {
    return gradeLocally(input, timeTaken)
  }

  // One entry per shown question (null selected_answer = skipped) so the server
  // can grade attendance and enqueue unattempted questions for revision.
  const pAnswers = questions.map((q) => {
    const a = answers[q.id]
    return {
      question_id: q.id,
      selected_answer: a?.selected_answer ?? null,
      time_spent_seconds: a?.time_spent_seconds ?? 0,
      flagged: flags[q.id] ?? false,
    }
  })

  const pSession = {
    category: config.category,
    group_type: config.group_type ?? null,
    subject: config.subject ?? null,
    standard: config.standard ?? null,
    topic: config.topic ?? null,
    // Extra scope the topic-revision hook needs to key/regenerate a test.
    unit: config.unit ?? null,
    question_type: config.question_type ?? null,
    difficulty: config.difficulty ?? null,
    ca_month: config.ca_month ?? null,
    ca_type: config.ca_type ?? null,
    ca_topic: config.ca_topic ?? null,
    aptitude_type: config.aptitude_type ?? null,
    aptitude_topic: config.aptitude_topic ?? null,
    // When set, this test is a revision re-attempt — a pass clears that row.
    revision_id: config.revisionId ?? null,
    total_questions: questions.length,
    time_limit_seconds: timeLimitSeconds,
    time_taken_seconds: timeTaken,
  }

  const result = (await api.submitTest(pSession, pAnswers)) as SubmitResult
  if (!result) throw new Error('No response from grader')

  // Merge graded correctness (+ gated explanations) back onto the questions.
  const byId = new Map<string, GradedResult>(
    result.results.map((r) => [r.question_id, r])
  )
  const mergedQuestions: Question[] = questions.map((q) => {
    const r = byId.get(q.id)
    if (result.unlocked && r) {
      return {
        ...q,
        correct_answer: r.correct_answer ?? undefined,
        explanation: r.explanation ?? undefined,
        explanation_ta: r.explanation_ta ?? undefined,
        why_wrong: r.why_wrong ?? undefined,
      }
    }
    return q
  })

  const gradedAnswers: Record<string, TestAnswer> = {}
  for (const r of result.results) {
    if (!r.selected_answer) continue
    gradedAnswers[r.question_id] = {
      question_id: r.question_id,
      selected_answer: r.selected_answer,
      is_correct: r.is_correct,
      time_spent_seconds: answers[r.question_id]?.time_spent_seconds ?? 0,
      flagged: flags[r.question_id] ?? false,
    }
  }

  return {
    config,
    questions: mergedQuestions,
    answers: gradedAnswers,
    totalQuestions: result.total,
    attempted: result.attempted,
    correct: result.correct,
    scorePercentage: result.score_percentage,
    pdfUnlocked: result.unlocked,
    passed80: result.passed_80,
    timeLimitSeconds,
    timeTakenSeconds: timeTaken,
    sessionId: result.session_id,
    revision: result.revision,
  }
}

/**
 * Grades a Thirukkural test entirely client-side. The bundled questions already
 * include `correct_answer`, so there's no server round-trip — we build the same
 * ResultPayload shape the Result page consumes (with answers always "unlocked"
 * so the review and explanations show).
 */
function gradeLocally(input: SubmitTestInput, timeTaken: number): ResultPayload {
  const { config, questions, answers, flags, timeLimitSeconds } = input

  let attempted = 0
  let correct = 0
  const gradedAnswers: Record<string, TestAnswer> = {}
  for (const q of questions) {
    const a = answers[q.id]
    const selected = a?.selected_answer ?? null
    if (!selected) continue
    attempted++
    const isCorrect = selected === q.correct_answer
    if (isCorrect) correct++
    gradedAnswers[q.id] = {
      question_id: q.id,
      selected_answer: selected,
      is_correct: isCorrect,
      time_spent_seconds: a?.time_spent_seconds ?? 0,
      flagged: flags[q.id] ?? false,
    }
  }

  const total = questions.length
  const scorePercentage = total > 0 ? Math.round((correct / total) * 100) : 0
  // Match the server grader: explanations/PDF unlock at the shared attendance
  // gate (>=25% attempted), not only on a full-attendance run.
  const unlocked = total > 0 && attempted / total >= ATTENDANCE_GATE

  return {
    config,
    questions, // already carry correct_answer for the review
    answers: gradedAnswers,
    totalQuestions: total,
    attempted,
    correct,
    scorePercentage,
    pdfUnlocked: unlocked,
    passed80: scorePercentage >= 80,
    timeLimitSeconds,
    timeTakenSeconds: timeTaken,
  }
}
