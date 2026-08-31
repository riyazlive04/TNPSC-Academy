// ─── Flashcards ("Instants") ────────────────────────────────────────────────
// Shared helpers for the dashboard tray and the full-screen deck viewer:
// bilingual field selection, the difficulty tag palette, and the study order.
//
// Swipe outcomes go straight to api.flashcards.grade(), which writes into the
// same review_items deck as the MCQ spaced revision (see supabase/flashcards.sql
// for why they can't share the grade_review RPC itself).

import type { FlashcardCard, FlashcardDeck, FlashcardDifficulty } from './api'
import type { Lang } from '../store/languageStore'

/**
 * Pick the language(s) to show for a piece of card content.
 *
 * Mirrors QuestionStem's rule so flashcards read like the rest of the app:
 * Tamil falls back to English when a card has no Tamil twin (the current
 * "Do You Know?" source is English-only), and bilingual mode stacks both.
 */
export function bilingual(en: string, ta: string | null | undefined, lang: Lang): string[] {
  const tamil = ta?.trim() || null
  if (lang === 'ta') return [tamil ?? en]
  if (lang === 'both') return tamil ? [en, tamil] : [en]
  return [en]
}

/** The deck's display title for the current language. */
export const deckTitle = (deck: FlashcardDeck, lang: Lang): string =>
  bilingual(deck.title_en, deck.title_ta, lang === 'both' ? 'en' : lang)[0]

/** The deck's speech-bubble teaser, or null when it has none. */
export function deckTeaser(deck: FlashcardDeck, lang: Lang): string | null {
  if (!deck.teaser_en) return null
  return bilingual(deck.teaser_en, deck.teaser_ta, lang === 'both' ? 'en' : lang)[0]
}

// ─── Difficulty tag ─────────────────────────────────────────────────────────
// The source doc colour-codes the three tags emerald / amber / red. Those map
// onto the design-system tint tokens so the tag re-themes with everything else
// in dark mode instead of burning a fixed hex.
export const DIFFICULTY_LABEL: Record<FlashcardDifficulty, { en: string; ta: string }> = {
  medium: { en: 'Medium', ta: 'நடுத்தரம்' },
  'hard-medium': { en: 'Hard-Medium', ta: 'சற்றுக் கடினம்' },
  hard: { en: 'Hard', ta: 'கடினம்' },
}

/** Tailwind classes for a difficulty pill. */
export const DIFFICULTY_CLASS: Record<FlashcardDifficulty, string> = {
  medium: 'bg-tint-green text-correct',
  'hard-medium': 'bg-tint-coral text-accent',
  hard: 'bg-wrong/15 text-wrong',
}

export const difficultyLabel = (d: FlashcardDifficulty, lang: Lang): string =>
  lang === 'ta' ? DIFFICULTY_LABEL[d].ta : DIFFICULTY_LABEL[d].en

// ─── Study order ────────────────────────────────────────────────────────────

/** A card the SRS wants seen now: never swiped, or its interval has elapsed. */
export const isDue = (card: FlashcardCard, now = Date.now()): boolean =>
  card.due_at === null || new Date(card.due_at).getTime() <= now

/**
 * Order a deck for a study run: everything due first (in the author's order),
 * then the rest so the learner can keep going past the due set rather than
 * hitting a dead end. Stable — a re-render never reshuffles mid-session.
 */
export function studyOrder(cards: FlashcardCard[]): FlashcardCard[] {
  const now = Date.now()
  const due = cards.filter((c) => isDue(c, now))
  const later = cards.filter((c) => !isDue(c, now))
  return [...due, ...later]
}
