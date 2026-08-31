import { Router, type Response, type NextFunction } from 'express'
import { asyncH, sendDbError } from '../util.js'
import { requireAuth, roleOf, type AuthedRequest } from '../middleware/auth.js'
import { readPublicSettings } from '../lib/settings.js'

const router = Router()

/**
 * Staff-only while the feature is dark. `flashcards_enabled` starts false, and
 * until a superadmin turns it on only admins may reach the decks — that is how
 * the whole thing is trialled against production data without any student
 * seeing it. The client hides the dashboard peek on the same flag; this is the
 * half that survives someone calling the API directly.
 */
async function requireFlashcardsVisible(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flashcards_enabled } = await readPublicSettings()
    if (flashcards_enabled) return next()
    const role = await roleOf(req.userId!)
    if (role === 'admin' || role === 'superadmin') return next()
    res.status(403).json({ error: 'flashcards_disabled' })
  } catch {
    // A settings read that fails must not open the feature up.
    res.status(403).json({ error: 'flashcards_disabled' })
  }
}

/** Validate a UUID so a malformed id can't reach the RPC as a bad cast. */
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

// ─── GET /api/flashcards/decks ───────────────────────────────────────────────
// Every live deck with its size and this user's due count — one request feeds
// the whole dashboard tray.
router.get(
  '/decks',
  requireAuth,
  requireFlashcardsVisible,
  asyncH(async (req: AuthedRequest, res) => {
    const { data, error } = await req.db!.rpc('get_flashcard_decks')
    if (error) return sendDbError(res, error)
    res.json({ decks: data ?? [] })
  })
)

// ─── GET /api/flashcards/decks/:id ───────────────────────────────────────────
// The cards of one deck, each with the user's spaced-revision state. Unlike the
// question bank there is no answer key to withhold — the answer IS the card.
router.get(
  '/decks/:id',
  requireAuth,
  requireFlashcardsVisible,
  asyncH(async (req: AuthedRequest, res) => {
    const { id } = req.params
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid deck id.' })
    const { data, error } = await req.db!.rpc('get_flashcard_deck', { p_deck_id: id })
    if (error) return sendDbError(res, error)
    res.json({ cards: data ?? [] })
  })
)

// ─── POST /api/flashcards/grade ──────────────────────────────────────────────
// One swipe: right ("Knew it") advances the card along the SM-2-lite curve,
// left ("Need to study") resets it and makes it due again immediately. Writes
// to the same review_items deck the MCQ revision uses — see supabase/flashcards.sql
// for why this can't route through grade_review.
router.post(
  '/grade',
  requireAuth,
  requireFlashcardsVisible,
  asyncH(async (req: AuthedRequest, res) => {
    const { itemId, knew } = req.body ?? {}
    if (typeof itemId !== 'string' || !isUuid(itemId)) {
      return res.status(400).json({ error: 'Invalid itemId.' })
    }
    // Strictly boolean: a truthy string would silently record the wrong outcome.
    if (typeof knew !== 'boolean') {
      return res.status(400).json({ error: 'knew must be a boolean.' })
    }
    const { data, error } = await req.db!.rpc('grade_flashcard', {
      p_item_id: itemId,
      p_knew: knew,
    })
    if (error) return sendDbError(res, error)
    res.json(data)
  })
)

export default router
