import { api } from './api'
import type { Question } from '../types'

/**
 * Bookmarks - let a student save questions and review them later. All calls go
 * through the API (the server writes to the RLS-protected `bookmarks` table and
 * reveals answers only for the user's own saved rows via `get_bookmarks`).
 */

export async function addBookmark(questionId: string): Promise<void> {
  await api.addBookmark(questionId)
}

export async function removeBookmark(questionId: string): Promise<void> {
  await api.removeBookmark(questionId)
}

/** The set of question ids the current user has bookmarked (for toggle state). */
export async function fetchBookmarkIds(): Promise<Set<string>> {
  const ids = await api.bookmarkIds()
  return new Set(ids)
}

/** Full saved questions (answers + explanations revealed) for the study page. */
export async function fetchBookmarkedQuestions(): Promise<Question[]> {
  return api.bookmarkedQuestions()
}
