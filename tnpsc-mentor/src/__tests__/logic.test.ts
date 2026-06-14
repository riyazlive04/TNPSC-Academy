import { describe, it, expect } from 'vitest'
import { formatTime } from '../components/UI/Timer'
import {
  displayQuestion,
  displayOption,
  displayExplanation,
  whyWrongFor,
  type Question,
  type TestAnswer,
} from '../types'
import { scoreByTopic, weakAreas } from '../lib/analytics'
import { describeConfig } from '../lib/fetchQuestions'
import { computeXp, levelInfo } from '../lib/game'
import { computeBadges, unlockedBadgeIds, type GameStats } from '../lib/achievements'

const baseQ = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  category: 'pyq',
  question_text: 'Capital of Tamil Nadu?',
  option_a: 'Chennai',
  option_b: 'Madurai',
  option_c: 'Coimbatore',
  option_d: 'Trichy',
  correct_answer: 'A',
  subject: 'Polity',
  topic: 'TN Geography',
  ...over,
})

describe('formatTime', () => {
  it('formats mm:ss with zero padding', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(5)).toBe('00:05')
    expect(formatTime(75)).toBe('01:15')
    expect(formatTime(2250)).toBe('37:30')
  })
  it('clamps negative time to zero', () => {
    expect(formatTime(-10)).toBe('00:00')
  })
})

describe('bilingual display helpers', () => {
  it('falls back to English when no Tamil content', () => {
    const q = baseQ()
    expect(displayQuestion(q, 'ta')).toBe('Capital of Tamil Nadu?')
    expect(displayOption(q, 'B', 'ta')).toBe('Madurai')
  })
  it('uses Tamil when present and lang is ta', () => {
    const q = baseQ({ question_text_ta: 'தமிழ்நாட்டின் தலைநகரம்?', option_a_ta: 'சென்னை' })
    expect(displayQuestion(q, 'ta')).toBe('தமிழ்நாட்டின் தலைநகரம்?')
    expect(displayOption(q, 'A', 'ta')).toBe('சென்னை')
  })
  it('stacks both languages for lang=both', () => {
    const q = baseQ({ question_text_ta: 'தலைநகரம்?' })
    expect(displayQuestion(q, 'both')).toBe('Capital of Tamil Nadu?\nதலைநகரம்?')
  })
  it('returns explanation and why-wrong safely when missing', () => {
    const q = baseQ()
    expect(displayExplanation(q, 'en')).toBe('')
    expect(whyWrongFor(q, 'B')).toBe('')
  })
  it('returns the per-option why-wrong reason when present', () => {
    const q = baseQ({ why_wrong: { B: 'Madurai is a temple city, not the capital.' } })
    expect(whyWrongFor(q, 'B')).toBe('Madurai is a temple city, not the capital.')
  })
})

describe('scoreByTopic / weakAreas', () => {
  const questions: Question[] = [
    baseQ({ id: 'a', topic: 'History' }),
    baseQ({ id: 'b', topic: 'History' }),
    baseQ({ id: 'c', topic: 'Polity' }),
  ]
  const answers: Record<string, TestAnswer> = {
    a: { question_id: 'a', selected_answer: 'A', is_correct: true, time_spent_seconds: 20 },
    b: { question_id: 'b', selected_answer: 'B', is_correct: false, time_spent_seconds: 20 },
    // 'c' skipped
  }

  it('computes per-topic accuracy over attempted only', () => {
    const scores = scoreByTopic(questions, answers)
    const history = scores.find((s) => s.key === 'History')!
    expect(history.total).toBe(2)
    expect(history.attempted).toBe(2)
    expect(history.correct).toBe(1)
    expect(history.accuracy).toBe(50)
    const polity = scores.find((s) => s.key === 'Polity')!
    expect(polity.attempted).toBe(0)
    expect(polity.accuracy).toBe(0)
  })

  it('flags only attempted topics below threshold', () => {
    const weak = weakAreas(scoreByTopic(questions, answers), 60)
    expect(weak.map((w) => w.key)).toEqual(['History'])
  })
})

describe('XP & levels', () => {
  it('rewards correct answers, attempts, and finished tests', () => {
    // 10 correct (×10) + 2 wrong (×2) + 1 test (×25) = 100 + 4 + 25
    expect(computeXp({ totalCorrect: 10, totalQuestions: 12, testsTaken: 1 })).toBe(129)
  })

  it('starts everyone at level 1 with 0 XP', () => {
    const l = levelInfo(0)
    expect(l.level).toBe(1)
    expect(l.into).toBe(0)
    expect(l.span).toBe(100)
    expect(l.pct).toBe(0)
    expect(l.toNext).toBe(100)
  })

  it('advances a level once the span is cleared and grows the next span', () => {
    const l = levelInfo(100) // clears the 100-XP first level exactly
    expect(l.level).toBe(2)
    expect(l.into).toBe(0)
    expect(l.span).toBe(135) // round(100 * 1.35)
  })

  it('reports partial progress within a level', () => {
    const l = levelInfo(40)
    expect(l.level).toBe(1)
    expect(l.into).toBe(40)
    expect(l.pct).toBe(40)
    expect(l.toNext).toBe(60)
  })
})

describe('achievements / badges', () => {
  const base: GameStats = {
    tests: 0, questions: 0, correct: 0, bestScore: 0, avgAccuracy: 0,
    minutes: 0, longestStreak: 0, currentStreak: 0, subjects: 0, totalSubjects: 10,
  }

  it('locks everything for a brand-new user', () => {
    expect(unlockedBadgeIds(base)).toEqual([])
  })

  it('unlocks threshold badges as stats grow', () => {
    const ids = unlockedBadgeIds({ ...base, tests: 1, questions: 120, bestScore: 100, longestStreak: 7 })
    expect(ids).toContain('first') // 1 test
    expect(ids).toContain('century') // 100 questions
    expect(ids).toContain('flawless') // 100% best
    expect(ids).toContain('onfire') // 7-day streak
    expect(ids).not.toContain('scholar') // needs 500 questions
  })

  it('derives the Syllabus Master target from the group size', () => {
    const partial = computeBadges({ ...base, subjects: 6, totalSubjects: 10 }).find((b) => b.id === 'master')!
    expect(partial.unlocked).toBe(false)
    expect(partial.target).toBe(10)
    const done = computeBadges({ ...base, subjects: 10, totalSubjects: 10 }).find((b) => b.id === 'master')!
    expect(done.unlocked).toBe(true)
  })
})

describe('describeConfig', () => {
  it('prefers an explicit label', () => {
    expect(describeConfig({ category: 'pyq', label: 'My Test' })).toBe('My Test')
  })
  it('builds a readable label from config parts', () => {
    expect(
      describeConfig({ category: 'samacheer', subject: 'Biology', standard: 10, topic: 'Cells' })
    ).toBe('SAMACHEER · Biology · 10th · Cells')
  })
})
