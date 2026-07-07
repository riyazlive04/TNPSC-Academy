import type { QuizConfig } from '../types'

// ─── Starter Challenge (new-user first test) ─────────────────────────────────
// A fixed-shape HARD mixed paper: 3 questions of every Subject-bank style
// (statements, match, assertion-reason, chronological, direct) plus 3 aptitude,
// sampled hard-first server-side (/api/questions/starter-test). Launched from
// the onboarding tour's final step and the dashboard's first-test hero.

/** Paper size — mirrors STARTER_TEST_SIZE on the server. */
export const STARTER_TEST_QUESTIONS = 18

/** Credits awarded once, when the first completed test is graded — mirrors
 *  FIRST_TEST_BONUS on the server (advertised in the hero/tour copy). */
export const FIRST_TEST_BONUS = 25

/** The QuizConfig that routes the quiz engine through the starter sampler.
 *  category 'subject' is only the session's bookkeeping label (the paper also
 *  mixes aptitude); with no subject/topic it never enqueues a revision. */
export function starterTestConfig(): QuizConfig {
  return {
    category: 'subject',
    starter: true,
    questionCount: STARTER_TEST_QUESTIONS,
    availableCount: STARTER_TEST_QUESTIONS,
    labelParts: [{ t: 'starterTestLabel' }],
  }
}
